import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { NextRequest } from "next/server";
import type { CartEventInput } from "@/lib/cart/event-log";

const recorded: { event: CartEventInput; userId: string | null }[] = [];
let sessionUserId: string | null = null;
const getSession = mock(async () =>
  sessionUserId ? { user: { id: sessionUserId } } : null,
);
const collectVisitor = mock(async (request: NextRequest) => ({
  ip: request.headers.get("x-real-ip"),
  at: new Date().toISOString(),
  device: /bot/i.test(request.headers.get("user-agent") ?? "")
    ? ("bot" as const)
    : ("desktop" as const),
}));

mock.module("@/lib/auth/session", () => ({ getSession }));
const visitor = await import("@/lib/visitor");
mock.module("@/lib/visitor", () => ({
  ...visitor,
  clientIp: (headers: Headers) => headers.get("x-real-ip"),
  collectVisitor,
}));
// Подменяем только запись: схема запроса — настоящая
const eventLog = await import("@/lib/cart/event-log");
mock.module("@/lib/cart/event-log", () => ({
  ...eventLog,
  recordCartEvent: async (
    event: CartEventInput,
    { userId }: { userId: string | null },
  ) => {
    recorded.push({ event, userId });
  },
}));

const { POST } = await import("./route");

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const request = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/cart/events", {
    method: "POST",
    headers: { "user-agent": CHROME, ...headers },
    body: JSON.stringify(body),
  });

const line = {
  productSlug: "tunika-5565",
  fulfillmentType: "stock" as const,
  name: "Туника",
  price: 350000,
};

const event = {
  cartId: "0b9f6a52-5f1e-4a8e-9a43-1f7c1c1e2d3a",
  action: "add",
  changes: [{ ...line, before: 0, after: 1 }],
  items: [{ ...line, quantity: 1, ozonSku: 3723160127 }],
};

let now = Date.now();
let clock: ReturnType<typeof spyOn<typeof Date, "now">>;
beforeEach(() => {
  now += 60_000;
  clock = spyOn(Date, "now").mockImplementation(() => now);
  recorded.length = 0;
  sessionUserId = null;
  getSession.mockClear();
  collectVisitor.mockClear();
});

afterEach(() => clock.mockRestore());

test("пишет событие гостя и отбрасывает лишние поля", async () => {
  const response = await POST(request(event));
  expect(response.status).toBe(204);
  expect(recorded).toHaveLength(1);
  expect(recorded[0]?.userId).toBeNull();
  expect(recorded[0]?.event.items[0]).toEqual({ ...line, quantity: 1 });
});

test("привязывает событие к аккаунту, если посетитель вошёл", async () => {
  sessionUserId = "user-1";
  await POST(request(event));
  expect(recorded[0]?.userId).toBe("user-1");
});

test("ботов не пишет", async () => {
  const response = await POST(
    request(event, { "user-agent": "Googlebot/2.1" }),
  );
  expect(response.status).toBe(204);
  expect(recorded).toHaveLength(0);
});

test("отклоняет запрос с чужого сайта", async () => {
  const response = await POST(
    request(event, { origin: "https://evil.example" }),
  );
  expect(response.status).toBe(403);
  expect(recorded).toHaveLength(0);
});

test("отклоняет неизвестное действие и кривой id корзины", async () => {
  expect((await POST(request({ ...event, action: "steal" }))).status).toBe(400);
  expect((await POST(request({ ...event, cartId: "../x" }))).status).toBe(400);
  expect(recorded).toHaveLength(0);
});

test("ограничивает IP, даже при смене корзины, до сбора visitor и сессии", async () => {
  for (let i = 0; i < 60; i++) {
    expect(
      (
        await POST(
          request(
            { ...event, cartId: `cart-id-${i}` },
            {
              "x-real-ip": "203.0.113.7",
            },
          ),
        )
      ).status,
    ).toBe(204);
  }
  collectVisitor.mockClear();
  getSession.mockClear();
  expect(
    (await POST(request(event, { "x-real-ip": "203.0.113.7" }))).status,
  ).toBe(429);
  expect(collectVisitor).not.toHaveBeenCalled();
  expect(getSession).not.toHaveBeenCalled();
  expect(recorded).toHaveLength(60);
  expect(
    (await POST(request(event, { "x-real-ip": "203.0.113.8" }))).status,
  ).toBe(204);
});

test("ограничивает корзину при смене IP и разрешает запросы через минуту", async () => {
  const responses = await Promise.all(
    Array.from({ length: 61 }, (_, i) =>
      POST(request(event, { "x-real-ip": `203.0.113.${i + 1}` })),
    ),
  );
  expect(responses.filter((response) => response.status === 204)).toHaveLength(
    60,
  );
  expect(responses.filter((response) => response.status === 429)).toHaveLength(
    1,
  );
  expect(recorded).toHaveLength(60);
  expect(collectVisitor).toHaveBeenCalledTimes(60);
  now += 59_999;
  expect((await POST(request(event))).status).toBe(429);
  now += 1;
  expect((await POST(request(event))).status).toBe(204);
  expect(recorded).toHaveLength(61);
});
