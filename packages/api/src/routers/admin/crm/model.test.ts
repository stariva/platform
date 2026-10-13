import { expect, test } from "bun:test";
import {
  buildClients,
  buildReport,
  type ClientRecord,
  type Deal,
  findClient,
  matchCampaign,
  moscowDay,
  normalizePhone,
  toMoscowDay,
} from "./model";

const touch = (utm_source: string, utm_campaign?: string) => ({
  first: { utm_source, utm_campaign, landing: "/", at: "2026-09-01T10:00:00Z" },
  last: { utm_source, utm_campaign, landing: "/", at: "2026-09-01T10:00:00Z" },
});

/** Создаёт тестовую сделку с базовыми полями и указанными переопределениями. */
function deal(overrides: Partial<Deal> & Pick<Deal, "id">): Deal {
  return {
    kind: "product",
    label: `Заказ ${overrides.id}`,
    status: "paid",
    createdAt: new Date("2026-09-10T10:00:00Z"),
    payments: [],
    attribution: null,
    name: "Анна",
    phone: null,
    emails: [],
    userId: null,
    clientId: null,
    ...overrides,
  };
}

/** Создаёт тестовую карточку клиента с указанными переопределениями. */
function record(overrides: Partial<ClientRecord> & Pick<ClientRecord, "id">) {
  return {
    name: "Анна",
    phone: null,
    email: null,
    sourceManual: false,
    campaignId: null,
    notes: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  } satisfies ClientRecord;
}

const campaigns = [
  { id: "direct", utmSource: "yandex", utmCampaign: null },
  { id: "direct-lamps", utmSource: "yandex", utmCampaign: "lamps" },
  { id: "avito", utmSource: null, utmCampaign: null },
];

test("russian phones normalize to 7XXXXXXXXXX", () => {
  expect(normalizePhone("+7 (916) 123-45-67")).toBe("79161234567");
  expect(normalizePhone("8 916 123 45 67")).toBe("79161234567");
  expect(normalizePhone("9161234567")).toBe("79161234567");
  expect(normalizePhone("123")).toBeNull();
});

test("days are counted in Moscow time", () => {
  expect(moscowDay("2026-10-01").toISOString()).toBe(
    "2026-09-30T21:00:00.000Z",
  );
  expect(toMoscowDay(new Date("2026-09-30T22:00:00Z"))).toBe("2026-10-01");
});

test("exact utm_campaign wins over the whole source", () => {
  expect(
    matchCampaign({ utm_source: "Yandex", utm_campaign: "LAMPS" }, campaigns),
  ).toBe("direct-lamps");
  expect(
    matchCampaign({ utm_source: "yandex", utm_campaign: "bags" }, campaigns),
  ).toBe("direct");
  expect(matchCampaign({ utm_source: "vk" }, campaigns)).toBeNull();
});

test("orders sharing a phone, email or account become one client", () => {
  const clients = buildClients(
    [
      deal({ id: "a", phone: "79161234567", emails: ["anna@mail.ru"] }),
      deal({ id: "b", phone: "79161234567" }),
      deal({
        id: "c",
        kind: "workshop",
        emails: ["anna@mail.ru"],
        userId: "u1",
      }),
      deal({
        id: "d",
        kind: "workshop",
        emails: ["other@mail.ru"],
        userId: "u1",
      }),
      deal({ id: "e", phone: "79990000000", name: "Ольга" }),
    ],
    [],
    campaigns,
  );
  expect(clients).toHaveLength(2);
  const anna = findClient(clients, "tel-79161234567");
  expect(anna?.deals.map((d) => d.id).sort()).toEqual(["a", "b", "c", "d"]);
  expect(findClient(clients, "mail-other@mail.ru")).toBe(anna);
});

test("source is the first tagged order, and all revenue goes to it", () => {
  const [client] = buildClients(
    [
      deal({
        id: "late",
        phone: "79161234567",
        createdAt: new Date("2026-10-05T10:00:00Z"),
        attribution: touch("vk"),
        payments: [{ at: new Date("2026-10-05T10:00:00Z"), amount: 300000 }],
      }),
      deal({
        id: "early",
        phone: "79161234567",
        createdAt: new Date("2026-09-05T10:00:00Z"),
        attribution: touch("yandex", "lamps"),
        payments: [{ at: new Date("2026-09-05T10:00:00Z"), amount: 500000 }],
      }),
    ],
    [],
    campaigns,
  );
  expect(client?.source).toEqual({
    kind: "campaign",
    campaignId: "direct-lamps",
    manual: false,
  });
  expect(client?.revenue).toBe(800000);
  expect(client?.paidDeals).toBe(2);
  expect(client?.deals[0]?.id).toBe("late");
});

test("a manual source overrides tags; manual sales join through the card", () => {
  const [client] = buildClients(
    [
      deal({ id: "site", phone: "79161234567", attribution: touch("yandex") }),
      deal({
        id: "sale",
        kind: "manual",
        name: null,
        clientId: "card",
        payments: [{ at: new Date("2026-09-20T09:00:00Z"), amount: 250000 }],
      }),
    ],
    [
      record({
        id: "card",
        phone: "79161234567",
        sourceManual: true,
        campaignId: "avito",
      }),
    ],
    campaigns,
  );
  expect(client?.key).toBe("card");
  expect(client?.source).toEqual({
    kind: "campaign",
    campaignId: "avito",
    manual: true,
  });
  expect(client?.deals).toHaveLength(2);
  expect(client?.revenue).toBe(250000);
});

test("report splits spend, new clients and revenue by period", () => {
  const clients = buildClients(
    [
      deal({
        id: "sep",
        phone: "79161234567",
        createdAt: new Date("2026-09-10T10:00:00Z"),
        attribution: touch("yandex"),
        payments: [{ at: new Date("2026-09-10T10:00:00Z"), amount: 400000 }],
      }),
      deal({
        id: "oct",
        phone: "79161234567",
        createdAt: new Date("2026-10-02T10:00:00Z"),
        payments: [{ at: new Date("2026-10-02T10:00:00Z"), amount: 100000 }],
      }),
      deal({
        id: "unknown",
        phone: "79990000000",
        createdAt: new Date("2026-10-03T10:00:00Z"),
        attribution: touch("telegram", "posev"),
      }),
      deal({ id: "organic", phone: "79880000000" }),
    ],
    [],
    campaigns,
  );
  const expenses = [
    { campaignId: "direct", spentOn: "2026-09-01", amount: 200000 },
    { campaignId: "direct", spentOn: "2026-10-01", amount: 150000 },
  ];
  const october = buildReport(clients, expenses, ["direct", "avito"], {
    from: moscowDay("2026-10-01"),
    to: moscowDay("2026-11-01"),
  });
  const byKey = Object.fromEntries(october.map((row) => [row.key, row]));

  expect(byKey["c:direct"]).toMatchObject({
    spend: 150000,
    leads: 0,
    buyers: 0,
    paidDeals: 1,
    revenue: 100000,
  });
  expect(byKey["c:avito"]).toMatchObject({ spend: 0, leads: 0, revenue: 0 });
  expect(byKey["u:telegram|posev"]).toMatchObject({ leads: 1, buyers: 0 });
  expect(byKey.none).toMatchObject({ leads: 0 });

  const september = buildReport(clients, expenses, [], {
    from: moscowDay("2026-09-01"),
    to: moscowDay("2026-10-01"),
  });
  expect(september.find((row) => row.key === "c:direct")).toMatchObject({
    spend: 200000,
    leads: 1,
    buyers: 1,
    revenue: 400000,
  });
});
