import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";

const env = {
  ROBOKASSA_LOGIN: "stariva",
  ROBOKASSA_PASSWORD_1: "pass1",
  ROBOKASSA_PASSWORD_2: "pass2",
  ROBOKASSA_HASH: "sha256" as const,
  ROBOKASSA_TEST: false,
};
mock.module("@/env", () => ({ env }));

const invoice = {
  id: 1042,
  productOrderId: null as string | null,
  workshopOrderId: "order-1" as string | null,
  amount: 149_000,
  paymentMethod: null as string | null,
  createdAt: new Date("2026-10-23T09:00:00Z"),
  paidAt: null as Date | null,
};
let stored = { ...invoice };
const updates: unknown[] = [];
// Цепочки drizzle: select().from().where().limit() и update().set().where()
mock.module("@stariva/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [stored] }) }),
    }),
    update: () => ({
      set: (values: Partial<typeof invoice>) => ({
        where: async () => {
          updates.push(values);
          stored = { ...stored, ...values };
        },
      }),
    }),
  },
}));

const {
  getRobokassaPayment,
  invoiceDescription,
  outSumToKopecks,
  parseRobokassaPaymentId,
  paymentUrl,
  robokassaPaymentId,
  verifyResultSignature,
} = await import("./robokassa");

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
beforeEach(() => {
  stored = { ...invoice };
  updates.length = 0;
  env.ROBOKASSA_TEST = false;
  fetchSpy = spyOn(globalThis, "fetch");
});
afterEach(() => fetchSpy.mockRestore());

const stateXml = (result: number, state?: number) =>
  new Response(
    `<?xml version="1.0" encoding="utf-8"?>
<OperationStateResponse xmlns="http://merchant.roboxchange.com/WebService/">
  <Result><Code>${result}</Code></Result>
  ${state === undefined ? "" : `<State><Code>${state}</Code><StateDate>2026-10-23T12:00:00+03:00</StateDate></State>`}
  <Info><PaymentMethod><Code>YandexPaySplit</Code></PaymentMethod><OutSum>1440.17</OutSum></Info>
</OperationStateResponse>`,
  );

test("payment link signs login, sum, invoice and password #1", () => {
  const url = new URL(
    paymentUrl(stored, "Мастер-класс «Ёлка макраме» — Stariva"),
  );
  expect(url.origin + url.pathname).toBe(
    "https://auth.robokassa.ru/Merchant/Index.aspx",
  );
  const params = url.searchParams;
  expect(params.get("OutSum")).toBe("1490.00");
  expect(params.get("InvId")).toBe("1042");
  expect(params.get("SignatureValue")).toBe(
    sha256("stariva:1490.00:1042:pass1"),
  );
  expect(params.getAll("PaymentMethods")).toEqual([
    "YandexPay",
    "YandexPaySplit",
  ]);
  expect(params.get("Description")).toBe("Мастер-класс Ёлка макраме - Stariva");
  expect(params.has("IsTest")).toBe(false);
  expect(params.has("Email")).toBe(false);
});

test("consents travel as signed Shp_ parameters in alphabetical order", () => {
  const url = new URL(
    paymentUrl(stored, "Заказ Stariva №1042", {
      pdConsent: "2026-10-15",
      offerAccepted: "2026-10-15",
    }),
  );
  expect(url.searchParams.get("Shp_offerAccepted")).toBe("2026-10-15");
  expect(url.searchParams.get("Shp_pdConsent")).toBe("2026-10-15");
  expect(url.searchParams.get("SignatureValue")).toBe(
    sha256(
      "stariva:1490.00:1042:pass1:Shp_offerAccepted=2026-10-15:Shp_pdConsent=2026-10-15",
    ),
  );
});

test("test mode marks the link with IsTest", () => {
  env.ROBOKASSA_TEST = true;
  const url = new URL(paymentUrl(stored, "Заказ Stariva №1042"));
  expect(url.searchParams.get("IsTest")).toBe("1");
});

test("description is cut to Robokassa's 100 characters", () => {
  expect(invoiceDescription("а".repeat(150))).toHaveLength(100);
});

test("result notification is checked with password #2 and sorted Shp_", () => {
  const sign = sha256("1490.000000:1042:pass2:Shp_a=1:Shp_b=2").toUpperCase();
  const params = new URLSearchParams({
    OutSum: "1490.000000",
    InvId: "1042",
    Shp_b: "2",
    Shp_a: "1",
    SignatureValue: sign,
  });
  expect(verifyResultSignature(params)).toBe(true);

  params.set("OutSum", "1.000000");
  expect(verifyResultSignature(params)).toBe(false);
  expect(verifyResultSignature(new URLSearchParams({ InvId: "1042" }))).toBe(
    false,
  );
});

test("Robokassa sums and payment ids round-trip", () => {
  expect(outSumToKopecks("1490.000000")).toBe(149_000);
  expect(outSumToKopecks("abc")).toBeNull();
  expect(robokassaPaymentId(1042)).toBe("robokassa:1042");
  expect(parseRobokassaPaymentId("robokassa:1042")).toBe(1042);
  expect(parseRobokassaPaymentId("2c3f-yookassa")).toBeNull();
  expect(parseRobokassaPaymentId("robokassa:x")).toBeNull();
});

test("a paid state from OpStateExt marks the invoice and keeps our amount", async () => {
  fetchSpy.mockResolvedValueOnce(stateXml(0, 100));
  const payment = await getRobokassaPayment(1042);

  const requested = new URL(String(fetchSpy.mock.calls[0]?.[0]));
  expect(requested.pathname).toEndWith("/OpStateExt");
  expect(requested.searchParams.get("Signature")).toBe(
    sha256("stariva:1042:pass2"),
  );
  expect(payment).toMatchObject({
    id: "robokassa:1042",
    status: "succeeded",
    paid: true,
    amount: { value: "1490.00", currency: "RUB" },
    metadata: { orderId: "order-1", kind: "workshop" },
  });
  expect(payment?.captured_at).toBeString();
  expect(updates).toHaveLength(1);
});

test("canceled, unknown and in-flight states map without marking paid", async () => {
  fetchSpy.mockResolvedValueOnce(stateXml(0, 10));
  expect((await getRobokassaPayment(1042))?.status).toBe("canceled");
  fetchSpy.mockResolvedValueOnce(stateXml(3));
  expect((await getRobokassaPayment(1042))?.status).toBe("pending");
  fetchSpy.mockResolvedValueOnce(stateXml(0, 50));
  expect((await getRobokassaPayment(1042))?.status).toBe("pending");
  expect(updates).toHaveLength(0);
});

test("a signature error from OpStateExt throws", async () => {
  fetchSpy.mockResolvedValueOnce(stateXml(1));
  await expect(getRobokassaPayment(1042)).rejects.toThrow(
    "robokassa_state_result_1",
  );
});

test("an invoice paid by notification and test mode skip OpStateExt", async () => {
  stored = { ...invoice, paidAt: new Date() };
  expect((await getRobokassaPayment(1042))?.status).toBe("succeeded");

  stored = { ...invoice };
  env.ROBOKASSA_TEST = true;
  expect((await getRobokassaPayment(1042))?.status).toBe("pending");
  expect(fetchSpy).not.toHaveBeenCalled();
});
