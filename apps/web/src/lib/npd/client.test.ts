import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";

mock.module("@/env", () => ({ env: { LKNPD_PASSWORD: "secret" } }));
const { createIncome, moscowTime, NpdError, resetNpdSession } = await import(
  "./client"
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const auth = () =>
  json({
    token: "t1",
    tokenExpireIn: new Date(Date.now() + 3_600_000).toISOString(),
    profile: { inn: "502480197143" },
  });

const input = {
  services: [
    { name: "Ёлка макраме", amount: 249_000, quantity: 2 },
    { name: "Доставка", amount: 35_050, quantity: 1 },
  ],
  operationTime: new Date("2026-10-19T09:30:00Z"),
};

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
beforeEach(() => {
  resetNpdSession();
  fetchSpy = spyOn(globalThis, "fetch");
});
afterEach(() => fetchSpy.mockRestore());

const bodyOf = (call: number) =>
  JSON.parse(String(fetchSpy.mock.calls[call]?.[1]?.body));

test("moscowTime prints the Moscow offset without milliseconds", () => {
  expect(moscowTime(new Date("2026-10-19T21:30:15.123Z"))).toBe(
    "2026-10-20T00:30:15+03:00",
  );
});

test("createIncome signs in and registers the income in rubles", async () => {
  fetchSpy
    .mockResolvedValueOnce(auth())
    .mockResolvedValueOnce(json({ approvedReceiptUuid: "203E2RALW5" }));

  expect(await createIncome(input)).toBe("203e2ralw5");

  expect(String(fetchSpy.mock.calls[0]?.[0])).toEndWith("/auth/lkfl");
  expect(bodyOf(0)).toMatchObject({
    username: "502480197143",
    password: "secret",
  });
  expect(String(fetchSpy.mock.calls[1]?.[0])).toEndWith("/income");
  expect(bodyOf(1)).toMatchObject({
    operationTime: "2026-10-19T12:30:00+03:00",
    services: [
      { name: "Ёлка макраме", amount: 2490, quantity: 2 },
      { name: "Доставка", amount: 350.5, quantity: 1 },
    ],
    totalAmount: "5330.50",
    client: { incomeType: "FROM_INDIVIDUAL" },
  });
});

test("createIncome signs in again once when the token is revoked", async () => {
  fetchSpy
    .mockResolvedValueOnce(auth())
    .mockResolvedValueOnce(json({}, 401))
    .mockResolvedValueOnce(auth())
    .mockResolvedValueOnce(json({ approvedReceiptUuid: "abc" }));

  expect(await createIncome(input)).toBe("abc");
  expect(fetchSpy).toHaveBeenCalledTimes(4);
});

test("a rejected income means there is no receipt", async () => {
  fetchSpy
    .mockResolvedValueOnce(auth())
    .mockResolvedValueOnce(json({ message: "bad" }, 422));

  const error = await createIncome(input).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(NpdError);
  expect((error as InstanceType<typeof NpdError>).outcome).toBe("not_created");
});

test("a failed sign-in means there is no receipt even on a 5xx", async () => {
  fetchSpy.mockResolvedValueOnce(json({}, 503));

  const error = await createIncome(input).catch((e: unknown) => e);
  expect((error as InstanceType<typeof NpdError>).outcome).toBe("not_created");
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

test("a 5xx or lost connection on income leaves the outcome unknown", async () => {
  fetchSpy.mockResolvedValueOnce(auth()).mockResolvedValueOnce(json({}, 500));
  const crashed = await createIncome(input).catch((e: unknown) => e);
  expect((crashed as InstanceType<typeof NpdError>).outcome).toBe("unknown");

  fetchSpy.mockRejectedValueOnce(new Error("ECONNRESET"));
  const lost = await createIncome(input).catch((e: unknown) => e);
  expect((lost as InstanceType<typeof NpdError>).outcome).toBe("unknown");
});
