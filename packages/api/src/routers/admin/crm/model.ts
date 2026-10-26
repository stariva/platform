import type { CampaignAttribution, CampaignTouch } from "@stariva/db/schema";

/**
 * CRM без отдельной базы клиентов: клиент — это все заказы, записи и ручные
 * продажи с общим телефоном, почтой или аккаунтом. Источник клиента — первый
 * заход по UTM-метке в самом раннем его заказе (или выбранный вручную), и вся
 * выручка клиента, в том числе повторные покупки, идёт этому источнику.
 */

/** Москва без перехода на летнее время. */
const MOSCOW = "+03:00";

/** Начало дня по Москве: «2026-10-01» → 2026-09-30T21:00Z. */
export const moscowDay = (day: string) => new Date(`${day}T00:00:00${MOSCOW}`);

/** День по Москве для даты: 2026-09-30T22:00Z → «2026-10-01». */
export function toMoscowDay(date: Date): string {
  return new Date(date.getTime() + 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** Только цифры; российские 8XXXXXXXXXX и 9XXXXXXXXX → 7XXXXXXXXXX. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    return `7${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith("9")) return `7${digits}`;
  return digits.length >= 6 ? digits : null;
}

/** Убирает пробелы и приводит почту к нижнему регистру; без @ возвращает null. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase();
  return email?.includes("@") ? email : null;
}

export const normalizeUtm = (value: string | null | undefined) =>
  value?.trim().toLowerCase() || null;

export interface CampaignRule {
  id: string;
  utmSource: string | null;
  utmCampaign: string | null;
}

/**
 * Кампания для захода по метке: сначала точное совпадение source и campaign,
 * затем кампания на весь source (utm_campaign не задан).
 */
export function matchCampaign(
  touch: Pick<CampaignTouch, "utm_source" | "utm_campaign">,
  campaigns: CampaignRule[],
): string | null {
  const source = normalizeUtm(touch.utm_source);
  if (!source) return null;
  const campaign = normalizeUtm(touch.utm_campaign);
  let wholeSource: string | null = null;
  for (const rule of campaigns) {
    if (rule.utmSource !== source) continue;
    if (rule.utmCampaign === null) wholeSource ??= rule.id;
    else if (rule.utmCampaign === campaign) return rule.id;
  }
  return wholeSource;
}

/** Заказ, запись на мастер-класс или ручная продажа. Суммы в копейках. */
export interface Deal {
  kind: "product" | "workshop" | "manual";
  id: string;
  label: string;
  status: string;
  createdAt: Date;
  // Поступившие деньги; пусто — не оплачен или возвращён
  payments: { at: Date; amount: number }[];
  attribution: CampaignAttribution | null;
  name: string | null;
  phone: string | null;
  emails: string[];
  userId: string | null;
  // Для ручной продажи — карточка клиента
  clientId: string | null;
  // Для ручной продажи — реклама, выбранная вручную; её выручка идёт туда
  campaignId: string | null;
}

export interface ClientRecord {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  sourceManual: boolean;
  campaignId: string | null;
  notes: string | null;
  createdAt: Date;
}

export type ClientSource =
  | { kind: "campaign"; campaignId: string; manual: boolean }
  | { kind: "utm"; utmSource: string; utmCampaign: string | null }
  | { kind: "none"; manual: boolean };

export interface Client {
  // Для адреса карточки: id карточки, иначе tel-… или mail-…
  key: string;
  record: ClientRecord | null;
  name: string;
  phones: string[];
  emails: string[];
  userIds: string[];
  // Новые сверху
  deals: Deal[];
  source: ClientSource;
  // Заход по метке, по которому определён источник
  touch: CampaignTouch | null;
  firstSeenAt: Date;
  firstPaidAt: Date | null;
  lastActivityAt: Date;
  revenue: number;
  paidDeals: number;
}

/** Группа сводки: кампания, метка без кампании или «без рекламы». */
export function sourceKey(source: ClientSource): string {
  switch (source.kind) {
    case "campaign":
      return `c:${source.campaignId}`;
    case "utm":
      return `u:${source.utmSource}|${source.utmCampaign ?? ""}`;
    default:
      return "none";
  }
}

const dealIdentities = (deal: Deal) => [
  ...(deal.phone ? [`phone:${deal.phone}`] : []),
  ...deal.emails.map((email) => `email:${email}`),
  ...(deal.userId ? [`user:${deal.userId}`] : []),
  ...(deal.clientId ? [`crm:${deal.clientId}`] : []),
];

const recordIdentities = (record: ClientRecord) => [
  `crm:${record.id}`,
  ...(record.phone ? [`phone:${record.phone}`] : []),
  ...(record.email ? [`email:${record.email}`] : []),
];

/** Склеивает всё, что связано общим телефоном, почтой, аккаунтом или карточкой. */
export function buildClients(
  deals: Deal[],
  records: ClientRecord[],
  campaigns: CampaignRule[],
): Client[] {
  const parent = new Map<string, string>();
  const find = (node: string): string => {
    let root = node;
    while (parent.has(root) && parent.get(root) !== root) {
      root = parent.get(root) as string;
    }
    parent.set(node, root);
    return root;
  };
  const link = (nodes: string[]) => {
    const [head, ...rest] = nodes;
    if (!head) return;
    if (!parent.has(head)) parent.set(head, head);
    for (const node of rest) {
      if (!parent.has(node)) parent.set(node, node);
      const a = find(head);
      const b = find(node);
      if (a !== b) parent.set(b, a);
    }
  };

  const dealNodes = deals.map((deal) => {
    const nodes = dealIdentities(deal);
    const own = nodes.length > 0 ? nodes : [`deal:${deal.kind}:${deal.id}`];
    link(own);
    return own[0] as string;
  });
  for (const record of records) link(recordIdentities(record));

  const groups = new Map<string, { deals: Deal[]; records: ClientRecord[] }>();
  const group = (node: string) => {
    const root = find(node);
    let entry = groups.get(root);
    if (!entry) {
      entry = { deals: [], records: [] };
      groups.set(root, entry);
    }
    return entry;
  };
  deals.forEach((deal, index) => {
    group(dealNodes[index] as string).deals.push(deal);
  });
  for (const record of records) group(`crm:${record.id}`).records.push(record);

  return [...groups.values()].map(({ deals: own, records: cards }) =>
    toClient(own, cards, campaigns),
  );
}

/** Собирает контакты, источник, даты и выручку из объединённых сделок и карточек. */
function toClient(
  deals: Deal[],
  records: ClientRecord[],
  campaigns: CampaignRule[],
): Client {
  const byDate = [...deals].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const record =
    [...records].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )[0] ?? null;

  const unique = (values: (string | null)[]) => [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
  const phones = unique([
    record?.phone ?? null,
    ...records.map((r) => r.phone),
    ...byDate.map((d) => d.phone),
  ]);
  const emails = unique([
    record?.email ?? null,
    ...records.map((r) => r.email),
    ...byDate.flatMap((d) => d.emails),
  ]);
  const userIds = unique(byDate.map((d) => d.userId));

  // Самый ранний заказ, по которому известна реклама: метка или выбор вручную
  const origin = byDate.find(
    (deal) =>
      deal.campaignId || normalizeUtm(deal.attribution?.first.utm_source),
  );
  // Без рекламы показываем хотя бы переход с чужого сайта (поиск, соцсети)
  const touch = origin?.campaignId
    ? null
    : ((origin ?? byDate.find((deal) => deal.attribution))?.attribution
        ?.first ?? null);
  let source: ClientSource;
  if (record?.sourceManual) {
    source = record.campaignId
      ? { kind: "campaign", campaignId: record.campaignId, manual: true }
      : { kind: "none", manual: true };
  } else if (origin?.campaignId) {
    source = { kind: "campaign", campaignId: origin.campaignId, manual: true };
  } else if (touch && normalizeUtm(touch.utm_source)) {
    const campaignId = matchCampaign(touch, campaigns);
    source = campaignId
      ? { kind: "campaign", campaignId, manual: false }
      : {
          kind: "utm",
          utmSource: normalizeUtm(touch.utm_source) as string,
          utmCampaign: normalizeUtm(touch.utm_campaign),
        };
  } else {
    source = { kind: "none", manual: false };
  }

  const payments = deals.flatMap((deal) => deal.payments);
  const firstPaidAt = payments.reduce<Date | null>(
    (first, payment) => (!first || payment.at < first ? payment.at : first),
    null,
  );
  const times = [
    ...byDate.map((deal) => deal.createdAt),
    ...payments.map((payment) => payment.at),
  ];
  const firstSeenAt = byDate[0]?.createdAt ?? record?.createdAt ?? new Date(0);
  const lastActivityAt = new Date(
    Math.max(
      (record?.createdAt ?? firstSeenAt).getTime(),
      ...times.map((at) => at.getTime()),
    ),
  );

  const latestName = [...byDate].reverse().find((deal) => deal.name)?.name;
  const first = byDate[0];
  let key = record?.id;
  if (!key && phones[0]) key = `tel-${phones[0]}`;
  if (!key && emails[0]) key = `mail-${emails[0]}`;
  if (!key && first) key = `deal-${first.kind}-${first.id}`;
  return {
    key: key ?? "",
    record,
    name: record?.name ?? latestName ?? emails[0] ?? "Без имени",
    phones,
    emails,
    userIds,
    deals: byDate.reverse(),
    source,
    touch: record?.sourceManual ? null : touch,
    firstSeenAt,
    firstPaidAt,
    lastActivityAt,
    revenue: payments.reduce((sum, payment) => sum + payment.amount, 0),
    paidDeals: deals.filter((deal) => deal.payments.length > 0).length,
  };
}

/** Находит клиента по адресу карточки: id карточки, tel-… или mail-…. */
export function findClient(clients: Client[], key: string): Client | null {
  if (key.startsWith("tel-")) {
    const phone = key.slice(4);
    return clients.find((client) => client.phones.includes(phone)) ?? null;
  }
  if (key.startsWith("mail-")) {
    const email = key.slice(5);
    return clients.find((client) => client.emails.includes(email)) ?? null;
  }
  return (
    clients.find((client) => client.key === key || client.record?.id === key) ??
    null
  );
}

export interface Period {
  // Включительно / не включительно; null — без границы
  from: Date | null;
  to: Date | null;
}

const within = (at: Date, { from, to }: Period) =>
  (!from || at >= from) && (!to || at < to);

export interface Expense {
  campaignId: string;
  spentOn: string;
  amount: number;
}

export interface ReportRow {
  key: string;
  source: ClientSource;
  spend: number;
  // Впервые обратились за период: заказ, заявка, запись
  leads: number;
  // Впервые заплатили за период
  buyers: number;
  // Заказы, по которым пришли первые деньги за период
  paidDeals: number;
  revenue: number;
}

/**
 * Сводка за период по источникам. Расход — по дням расходов, выручка — по
 * дням поступления денег, клиенты — по первому обращению и первой оплате.
 */
export function buildReport(
  clients: Client[],
  expenses: Expense[],
  campaignIds: string[],
  period: Period,
): ReportRow[] {
  const rows = new Map<string, ReportRow>();
  const row = (source: ClientSource) => {
    const key = sourceKey(source);
    let entry = rows.get(key);
    if (!entry) {
      entry = {
        key,
        source,
        spend: 0,
        leads: 0,
        buyers: 0,
        paidDeals: 0,
        revenue: 0,
      };
      rows.set(key, entry);
    }
    return entry;
  };
  for (const campaignId of campaignIds) {
    row({ kind: "campaign", campaignId, manual: false });
  }

  for (const expense of expenses) {
    if (!within(moscowDay(expense.spentOn), period)) continue;
    row({
      kind: "campaign",
      campaignId: expense.campaignId,
      manual: false,
    }).spend += expense.amount;
  }

  for (const client of clients) {
    const entry = row(client.source);
    if (within(client.firstSeenAt, period)) entry.leads += 1;
    if (client.firstPaidAt && within(client.firstPaidAt, period)) {
      entry.buyers += 1;
    }
    for (const deal of client.deals) {
      // Ручной заказ с выбранной рекламой приносит деньги ей, а не источнику клиента
      const target = deal.campaignId
        ? row({ kind: "campaign", campaignId: deal.campaignId, manual: true })
        : entry;
      const first = deal.payments.reduce<Date | null>(
        (min, payment) => (!min || payment.at < min ? payment.at : min),
        null,
      );
      if (first && within(first, period)) target.paidDeals += 1;
      for (const payment of deal.payments) {
        if (within(payment.at, period)) target.revenue += payment.amount;
      }
    }
  }

  return [...rows.values()];
}
