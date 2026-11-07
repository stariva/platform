import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";

const env: Record<string, string | number | undefined> = {
  OZON_BUSINESS_DELIVERY_CLIENT_ID: "client-id",
  OZON_BUSINESS_DELIVERY_CLIENT_SECRET: "client-secret",
  OZON_BUSINESS_DELIVERY_SHIPMENT_METHOD_ID: 42,
};
mock.module("@/env", () => ({ env }));
const {
  createParcelShipment,
  isOzonBusinessDeliveryConfigured,
  quoteParcel,
  resetOzonBusinessSession,
} = await import("../../src/lib/ozon-business-delivery/client");
const {
  isOzonBusinessAccessError,
  isOzonBusinessRejection,
  OzonBusinessAccessError,
  OzonBusinessDeliveryError,
  ParcelNotApprovedError,
} = await import("../../src/lib/ozon-business-delivery/errors");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const tokenResponse = () => json({ access_token: "tok", expires_in: 3600 });

const request = {
  recipientPhone: "8 (900) 123-45-67",
  pointId: "1234",
  parcel: { weightGrams: 800, lengthCm: 60, widthCm: 30, heightCm: 20 },
  declaredValueKopecks: 390_000,
};

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
beforeEach(() => {
  resetOzonBusinessSession();
  env.OZON_BUSINESS_DELIVERY_CLIENT_ID = "client-id";
  env.OZON_BUSINESS_DELIVERY_CLIENT_SECRET = "client-secret";
  env.OZON_BUSINESS_DELIVERY_SHIPMENT_METHOD_ID = 42;
  fetchSpy = spyOn(globalThis, "fetch");
});
afterEach(() => fetchSpy.mockRestore());

const urlOf = (call: number) => String(fetchSpy.mock.calls[call]?.[0]);
const initOf = (call: number) => fetchSpy.mock.calls[call]?.[1] as RequestInit;
const bodyOf = (call: number) => JSON.parse(String(initOf(call).body));
const headersOf = (call: number) =>
  (initOf(call).headers ?? {}) as Record<string, string>;

test("the integration is on only when the keys and the shipment method are set", () => {
  expect(isOzonBusinessDeliveryConfigured()).toBe(true);
  env.OZON_BUSINESS_DELIVERY_SHIPMENT_METHOD_ID = undefined;
  expect(isOzonBusinessDeliveryConfigured()).toBe(false);
  env.OZON_BUSINESS_DELIVERY_SHIPMENT_METHOD_ID = 42;
  env.OZON_BUSINESS_DELIVERY_CLIENT_SECRET = undefined;
  expect(isOzonBusinessDeliveryConfigured()).toBe(false);
});

test("the quote asks Ozon for the parcel and adds insurance to the delivery", async () => {
  fetchSpy
    .mockResolvedValueOnce(tokenResponse())
    .mockResolvedValueOnce(json({ can_be_delivered: true }))
    .mockResolvedValueOnce(
      json({
        results: [
          {
            request_id: 1,
            posting: {
              estimated_delivery_cost: {
                amount: "250.00",
                currency_code: "RUB",
              },
              estimated_insurance_cost: {
                amount: "19.5",
                currency_code: "RUB",
              },
              estimated_delivery_days: 3,
              cutoff_at: "2026-11-10T12:00:00Z",
            },
          },
        ],
      }),
    );

  expect(await quoteParcel(request)).toEqual({
    available: true,
    priceKopecks: 26_950,
  });

  expect(urlOf(0)).toBe("https://xapi.ozon.ru/oauth/token");
  expect(bodyOf(0)).toEqual({
    client_id: "client-id",
    client_secret: "client-secret",
    grant_type: "client_credentials",
    scope: [
      "delivery-api.delivery",
      "delivery-api.delivery-point",
      "delivery-api.order",
      "delivery-api.posting",
    ],
  });
  expect(urlOf(1)).toBe(
    "https://api-delivery.ozon.ru/v1/delivery/check-client",
  );
  expect(headersOf(1).Authorization).toBe("Bearer tok");
  expect(bodyOf(1)).toEqual({ phone_number: "+79001234567" });
  expect(urlOf(2)).toBe("https://api-delivery.ozon.ru/v1/order/checkout");
  expect(bodyOf(2)).toEqual({
    recipient: { phone_number: "+79001234567" },
    postings: [
      {
        request_id: 1,
        shipment_method_id: 42,
        declared_value: { amount: "3900.00", currency_code: "RUB" },
        dimensions: {
          weight_g: 800,
          length_mm: 600,
          width_mm: 300,
          height_mm: 200,
        },
      },
    ],
    delivery: { delivery_point: { delivery_point_id: 1234 } },
  });
});

test("the token is reused between calls", async () => {
  fetchSpy
    .mockResolvedValueOnce(tokenResponse())
    .mockResolvedValueOnce(json({ can_be_delivered: false }))
    .mockResolvedValueOnce(json({ can_be_delivered: false }));
  await quoteParcel(request);
  await quoteParcel(request);
  expect(fetchSpy).toHaveBeenCalledTimes(3);
});

test("a refusal from Ozon becomes a reason for the master", async () => {
  fetchSpy
    .mockResolvedValueOnce(tokenResponse())
    .mockResolvedValueOnce(json({ can_be_delivered: true }))
    .mockResolvedValueOnce(
      json({
        results: [
          {
            request_id: 1,
            error: { code: "DeliveryPointRestrictionsError", message: "x" },
          },
        ],
      }),
    );

  const quote = await quoteParcel(request);
  expect(quote.available).toBe(false);
  if (quote.available) throw new Error("expected a refusal");
  expect(quote.reason).toContain("Пункт не принимает такую посылку");
  expect(quote.reason).toContain("вручную");
});

test("a buyer who is not in Ozon gets no checkout", async () => {
  fetchSpy
    .mockResolvedValueOnce(tokenResponse())
    .mockResolvedValueOnce(json({ can_be_delivered: false }));

  const quote = await quoteParcel(request);
  expect(quote.available).toBe(false);
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

test("a phone that is not Russian is refused without calling Ozon", async () => {
  const quote = await quoteParcel({
    ...request,
    recipientPhone: "+44 20 7946 0958",
  });
  expect(quote.available).toBe(false);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("Ozon's anti-bot redirect is repeated as the same POST with its cookie", async () => {
  fetchSpy
    .mockResolvedValueOnce(
      new Response(null, {
        status: 307,
        headers: {
          Location: "https://xapi.ozon.ru/oauth/token",
          "Set-Cookie": "testcookie=abc123; Path=/; HttpOnly",
        },
      }),
    )
    .mockResolvedValueOnce(tokenResponse())
    .mockResolvedValueOnce(json({ can_be_delivered: false }));

  await quoteParcel(request);

  expect(initOf(1).method).toBe("POST");
  expect(initOf(1).body).toBe(initOf(0).body);
  expect(headersOf(1).Cookie).toBe("testcookie=abc123");
});

test("a redirect to another address is not followed", async () => {
  fetchSpy.mockResolvedValueOnce(
    new Response(null, {
      status: 302,
      headers: { Location: "https://evil.example/steal" },
    }),
  );
  await expect(quoteParcel(request)).rejects.toThrow("unexpected_redirect_302");
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

test("a revoked token is replaced once", async () => {
  fetchSpy
    .mockResolvedValueOnce(tokenResponse())
    .mockResolvedValueOnce(json({ error: { message: "expired" } }, 401))
    .mockResolvedValueOnce(json({ access_token: "tok2", expires_in: 3600 }))
    .mockResolvedValueOnce(json({ can_be_delivered: false }));

  await quoteParcel(request);

  expect(headersOf(3).Authorization).toBe("Bearer tok2");
});

const created = {
  order_number: "YY-123-90YY",
  postings: [{ request_id: 1, posting_number: "123-90YY-1" }],
};
const shipment = {
  ...request,
  externalOrderId: "order-1",
  recipientName: "Анна",
  items: [{ name: "Ёлка", quantity: 2, priceKopecks: 195_000 }],
};

test("a shipment is created and then approved for pick-up", async () => {
  fetchSpy
    .mockResolvedValueOnce(tokenResponse())
    .mockResolvedValueOnce(json(created))
    .mockResolvedValueOnce(json({}));

  expect(await createParcelShipment(shipment)).toEqual({
    orderId: "YY-123-90YY",
    postingNumbers: ["123-90YY-1"],
  });

  expect(urlOf(1)).toBe("https://api-delivery.ozon.ru/v1/order/create");
  expect(bodyOf(1)).toMatchObject({
    order_external_id: "order-1",
    recipient: { phone_number: "+79001234567", full_name: "Анна" },
    delivery: { delivery_point: { delivery_point_id: 1234 } },
    postings: [
      {
        request_id: 1,
        posting_external_id: "order-1",
        shipment_method_id: 42,
        description: "Ёлка × 2",
        declared_value: { amount: "3900.00", currency_code: "RUB" },
      },
    ],
  });
  expect(urlOf(2)).toBe("https://api-delivery.ozon.ru/v1/posting/approve");
  expect(bodyOf(2)).toEqual({ posting_number: "123-90YY-1" });
});

test("an approval that fails keeps the numbers of the created order", async () => {
  fetchSpy
    .mockResolvedValueOnce(tokenResponse())
    .mockResolvedValueOnce(json(created))
    .mockResolvedValueOnce(
      json(
        { error: { code: "NotEnoughBalance", message: "Нет баланса" } },
        400,
      ),
    );

  const error = await createParcelShipment(shipment).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(ParcelNotApprovedError);
  const failure = error as InstanceType<typeof ParcelNotApprovedError>;
  expect(failure.parcel).toEqual({
    orderId: "YY-123-90YY",
    postingNumbers: ["123-90YY-1"],
  });
  expect(failure.cause).toBeInstanceOf(OzonBusinessDeliveryError);
  expect((failure.cause as { code?: string }).code).toBe("NotEnoughBalance");
});

test("Ozon refusing to create the order is a plain error with its code", async () => {
  fetchSpy
    .mockResolvedValueOnce(tokenResponse())
    .mockResolvedValueOnce(
      json(
        { error: { code: "DeliveryPointNotFound", message: "Нет пункта" } },
        400,
      ),
    );

  const error = await createParcelShipment(shipment).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(OzonBusinessDeliveryError);
  expect(error).not.toBeInstanceOf(ParcelNotApprovedError);
  expect((error as { code?: string }).code).toBe("DeliveryPointNotFound");
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

test("an error body with unexpected types keeps the start of the body", () => {
  const error = OzonBusinessDeliveryError.fromResponse(
    "/v1/order/create",
    400,
    '{"error":{"code":5,"message":{"a":1}}}',
  );

  expect(error.code).toBeUndefined();
  expect(error.detail).toBe('{"error":{"code":5,"message":{"a":1}}}');
  expect(error.message).not.toContain("[object Object]");
});

test("a page that is not JSON is kept as the detail", () => {
  const error = OzonBusinessDeliveryError.fromResponse(
    "/v1/order/create",
    502,
    "<html>Bad gateway</html>",
  );

  expect(error.code).toBeUndefined();
  expect(error.detail).toBe("<html>Bad gateway</html>");
});

test("keys Ozon refuses are an access error, an outage of Ozon is not", async () => {
  fetchSpy.mockResolvedValueOnce(json({ error: "invalid_client" }, 401));
  const refused = await quoteParcel(request).catch((e: unknown) => e);
  expect(refused).toBeInstanceOf(OzonBusinessAccessError);
  expect(isOzonBusinessAccessError(refused)).toBe(true);

  resetOzonBusinessSession();
  fetchSpy.mockResolvedValueOnce(json({ error: "unavailable" }, 503));
  const outage = await quoteParcel(request).catch((e: unknown) => e);
  expect(outage).not.toBeInstanceOf(OzonBusinessAccessError);
  expect(isOzonBusinessAccessError(outage)).toBe(false);
});

test("an app without the needed scope is an access error too", async () => {
  fetchSpy
    .mockResolvedValueOnce(tokenResponse())
    .mockResolvedValueOnce(json({ error: { message: "forbidden" } }, 403));
  const error = await quoteParcel(request).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(OzonBusinessDeliveryError);
  expect(isOzonBusinessAccessError(error)).toBe(true);
});

test("only a request Ozon refuses for good is a rejection, not access or a temporary error", () => {
  const error = (status: number) =>
    new OzonBusinessDeliveryError("/v1/order/checkout", status, undefined, "x");

  expect(isOzonBusinessRejection(error(400))).toBe(true);
  expect(isOzonBusinessRejection(error(404))).toBe(true);
  expect(isOzonBusinessRejection(error(422))).toBe(true);
  // Доступ, таймаут и лимит запросов — другие случаи
  for (const status of [401, 403, 408, 429, 500, 503]) {
    expect(isOzonBusinessRejection(error(status))).toBe(false);
  }
  expect(isOzonBusinessRejection(new Error("timeout"))).toBe(false);
});
