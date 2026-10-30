import { beforeEach, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";
import type { CampaignAttribution } from "@stariva/db/schema";
import type { CartEventInput } from "@/lib/cart/event-log";
import { ATTRIBUTION_COOKIE } from "@/lib/campaign-attribution";

const recorded: {
  event: CartEventInput;
  userId: string | null;
  attribution: CampaignAttribution | null;
}[] = [];
let sessionUserId: string | null = null;

mock.module("@/lib/auth/session", () => ({
  getSession: async () =>
    sessionUserId ? { user: { id: sessionUserId } } : null,
}));
// Подменяем только запись: схема запроса — настоящая
const eventLog = await import("@/lib/cart/event-log");
mock.module("@/lib/cart/event-log", () => ({
  ...eventLog,
  recordCartEvent: async (
    event: CartEventInput,
    {
      userId,
      attribution,
    }: { userId: string | null; attribution: CampaignAttribution | null },
  ) => {
    recorded.push({ event, userId, attribution });
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

beforeEach(() => {
  recorded.length = 0;
  sessionUserId = null;
});

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

test("пишет заход вкладки и UTM из cookie: с какой рекламы пришли", async () => {
  const touch = {
    utm_source: "yandex",
    utm_medium: "cpc",
    utm_campaign: "gnomes",
    landing: "/catalog",
    at: "2026-10-30T10:00:00.000Z",
  };
  const entry = { ...touch, yclid: "123", at: "2026-10-30T10:05:00.000Z" };
  await POST(
    request(
      { ...event, entry },
      {
        cookie: `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify({ first: touch, last: touch }))}`,
      },
    ),
  );
  expect(recorded[0]?.event.entry).toEqual(entry);
  expect(recorded[0]?.attribution?.last.utm_campaign).toBe("gnomes");
});

test("битый заход не теряет событие", async () => {
  const response = await POST(request({ ...event, entry: { landing: 5 } }));
  expect(response.status).toBe(204);
  expect(recorded[0]?.event.entry).toBeUndefined();
  expect(recorded[0]?.attribution).toBeNull();
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
