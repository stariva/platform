import { beforeEach, expect, mock, test } from "bun:test";
import type { CampaignAttribution } from "@stariva/db/schema";
import { NextRequest } from "next/server";
import { ATTRIBUTION_COOKIE } from "@/lib/campaign-attribution";
import type { ContactClickInput } from "@/lib/contact-clicks/click-log";

const recorded: {
  click: ContactClickInput;
  userId: string | null;
  attribution: CampaignAttribution | null;
}[] = [];
let sessionUserId: string | null = null;

mock.module("@/lib/auth/session", () => ({
  getSession: async () =>
    sessionUserId ? { user: { id: sessionUserId } } : null,
}));
// Подменяем только запись: схема запроса — настоящая
const clickLog = await import("@/lib/contact-clicks/click-log");
mock.module("@/lib/contact-clicks/click-log", () => ({
  ...clickLog,
  recordContactClick: async (
    click: ContactClickInput,
    {
      userId,
      attribution,
    }: { userId: string | null; attribution: CampaignAttribution | null },
  ) => {
    recorded.push({ click, userId, attribution });
  },
}));

const { POST } = await import("./route");

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const request = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/contact/clicks", {
    method: "POST",
    headers: { "user-agent": CHROME, ...headers },
    body: JSON.stringify(body),
  });

const entry = {
  landing: "/elka-makrame-bolshaya",
  referrer: "yandex.ru",
  utm_source: "yandex",
  utm_campaign: "elka_big",
  yclid: "7364528190",
  at: "2026-10-22T09:00:00.000Z",
};

const click = {
  browserId: "0b9f6a52-5f1e-4a8e-9a43-1f7c1c1e2d3a",
  channel: "telegram",
  source: "elka_big",
  page: "/elka-makrame-bolshaya",
  entry,
};

beforeEach(() => {
  recorded.length = 0;
  sessionUserId = null;
});

test("пишет клик гостя с заходом и отбрасывает лишние поля", async () => {
  const response = await POST(
    request({ ...click, entry: { ...entry, email: "a@b.ru" }, extra: 1 }),
  );
  expect(response.status).toBe(204);
  expect(recorded).toHaveLength(1);
  expect(recorded[0]?.userId).toBeNull();
  expect(recorded[0]?.click).toEqual(click as ContactClickInput);
});

test("берёт UTM-атрибуцию из cookie и аккаунт из сессии", async () => {
  sessionUserId = "user-1";
  const touch = { utm_source: "vk", landing: "/", at: entry.at };
  await POST(
    request(click, {
      cookie: `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify({ first: touch, last: touch }))}`,
    }),
  );
  expect(recorded[0]?.userId).toBe("user-1");
  expect(recorded[0]?.attribution?.last.utm_source).toBe("vk");
});

test("битый заход не теряет клик", async () => {
  await POST(request({ ...click, entry: { landing: 5 } }));
  expect(recorded).toHaveLength(1);
  expect(recorded[0]?.click.entry).toBeUndefined();
});

test("ботов не пишет", async () => {
  const response = await POST(
    request(click, { "user-agent": "Googlebot/2.1" }),
  );
  expect(response.status).toBe(204);
  expect(recorded).toHaveLength(0);
});

test("отклоняет запрос с чужого сайта", async () => {
  const response = await POST(
    request(click, { origin: "https://evil.example" }),
  );
  expect(response.status).toBe(403);
  expect(recorded).toHaveLength(0);
});

test("отклоняет неизвестный канал и кривой блок", async () => {
  expect((await POST(request({ ...click, channel: "icq" }))).status).toBe(400);
  expect((await POST(request({ ...click, source: "<b>" }))).status).toBe(400);
  expect(recorded).toHaveLength(0);
});
