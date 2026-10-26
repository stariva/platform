import { ORPCError } from "@orpc/server";
import {
  adCampaigns,
  and,
  crmSalePayments,
  crmSales,
  customOrderRequests,
  type Database,
  eq,
  gte,
  isNull,
  productOrderItems,
} from "@stariva/db";
import type { CrmOrderStatus, OrderChannel } from "@stariva/db/schema";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { toKopecks } from "../orders/stage-math";
import { field } from "../requests/fields";
import { loadCrm } from "./load";
import {
  findClient,
  moscowDay,
  normalizeEmail,
  normalizePhone,
  type Period,
  toMoscowDay,
} from "./model";
import { daySchema } from "./report";
import { rubles } from "./shape";
import {
  ACTIVE_STAGES,
  clientKeys,
  daysSince,
  isActive,
  isOverdue,
  lastMonths,
  manualStage,
  newVsRepeat,
  paidSum,
  productStage,
  type SalesTotals,
  type Stage,
  toCollect,
  topItems,
  totals,
  totalsBy,
  type WorkOrder,
  type WorkType,
  workshopStage,
} from "./work";

export const ORDER_CHANNELS = [
  "avito",
  "ozon",
  "wildberries",
  "yandex_market",
  "yarmarka",
  "telegram",
  "whatsapp",
  "instagram",
  "vk",
  "offline",
  "other",
] as const satisfies readonly OrderChannel[];

export const CRM_ORDER_STATUSES = [
  "new",
  "awaiting_payment",
  "in_production",
  "ready",
  "shipped",
  "done",
  "canceled",
] as const satisfies readonly CrmOrderStatus[];

const STAGES = [
  ...ACTIVE_STAGES,
  "done",
  "canceled",
  "unpaid",
] as const satisfies readonly Stage[];

const TYPES = [
  "stock",
  "made_to_order",
  "workshop",
  "external",
  "request",
] as const satisfies readonly WorkType[];

/** Заявки старше этого срока без заказа в ленту не попадают — их уже не ждут. */
const REQUEST_FRESH_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

/** Полдень дня по Москве — время ручного заказа и его оплат. */
const noon = (day: string) =>
  new Date(moscowDay(day).getTime() + 12 * 3600_000);

/**
 * Все заказы в одной ленте: с сайта, записи на мастер-классы, заказы вне
 * сайта и свежие заявки без заказа. Заказов сотни — собираем в памяти.
 */
export async function loadWork(db: Database, now = new Date()) {
  const crm = await loadCrm(db);
  const freshSince = new Date(now.getTime() - REQUEST_FRESH_DAYS * DAY);
  const [items, requests] = await Promise.all([
    db
      .select({
        orderId: productOrderItems.orderId,
        name: productOrderItems.name,
        quantity: productOrderItems.quantity,
        price: productOrderItems.price,
      })
      .from(productOrderItems),
    db
      .select({
        number: customOrderRequests.number,
        name: field("name"),
        contact: field("contact"),
        description: field("description"),
        productType: field("productType"),
        createdAt: customOrderRequests.createdAt,
      })
      .from(customOrderRequests)
      .where(
        and(
          isNull(customOrderRequests.archivedAt),
          gte(customOrderRequests.createdAt, freshSince),
        ),
      ),
  ]);

  const itemsByOrder = new Map<string, WorkOrder["items"]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }
  const dealPayments = new Map(
    crm.deals.map((deal) => [`${deal.kind}:${deal.id}`, deal.payments]),
  );
  const keyFor = clientKeys(crm.clients);
  const records = new Map(crm.records.map((record) => [record.id, record]));
  // Заявка с заказом — записанным в CRM или со счётом на сайте — уже не новая
  const takenRequests = new Set(
    [...crm.sales, ...crm.productRows]
      .map((order) => order.requestNumber)
      .filter(Boolean),
  );

  const orders: WorkOrder[] = [
    ...crm.productRows.map((order): WorkOrder => {
      const phone = normalizePhone(order.contactPhone);
      const email = normalizeEmail(order.contactEmail);
      const own = itemsByOrder.get(order.id) ?? [];
      const [first, ...rest] = own;
      const stage = productStage(order.status);
      return {
        kind: "product",
        id: order.id,
        number: `№${order.number}`,
        type: order.kind,
        channel: "site",
        title: first
          ? `${first.name}${first.quantity > 1 ? ` × ${first.quantity}` : ""}${rest.length ? ` и ещё ${rest.length}` : ""}`
          : `Заказ №${order.number}`,
        clientName: order.contactName,
        phone,
        email,
        clientKey: keyFor(phone, email),
        stage,
        status: order.status,
        amount: order.amountTotal,
        payments: dealPayments.get(`product:${order.id}`) ?? [],
        fee: 0,
        createdAt: order.createdAt,
        dueOn: null,
        paymentDueAt: order.paymentDueAt,
        // Точно известно только начало изготовления и момент одобрения
        stageSince:
          stage === "in_work"
            ? (order.depositPaidAt ?? order.paidAt)
            : stage === "awaiting_payment"
              ? order.approvedAt
              : null,
        closedAt: null,
        campaignId: null,
        items: own,
      };
    }),
    ...crm.workshopRows.map((order): WorkOrder => {
      const email = normalizeEmail(order.contactEmail ?? order.userEmail);
      return {
        kind: "workshop",
        id: order.id,
        number: null,
        type: "workshop",
        channel: "site",
        title: order.workshopTitle ?? order.workshopSlug,
        clientName: order.userName,
        phone: null,
        email,
        clientKey: keyFor(null, email),
        stage: workshopStage(order.status),
        status: order.status,
        amount: order.amount,
        payments: dealPayments.get(`workshop:${order.id}`) ?? [],
        fee: 0,
        createdAt: order.createdAt,
        dueOn: null,
        paymentDueAt: null,
        stageSince: null,
        closedAt: order.paidAt,
        campaignId: null,
        items: [],
      };
    }),
    ...crm.sales.map((sale): WorkOrder => {
      const record = records.get(sale.clientId);
      return {
        kind: "manual",
        id: sale.id,
        number: sale.externalNumber,
        type: "external",
        channel: sale.channel,
        title: sale.description,
        clientName: record?.name ?? "Без имени",
        phone: record?.phone ?? null,
        email: record?.email ?? null,
        clientKey: sale.clientId,
        stage: manualStage(sale.status),
        status: sale.status,
        amount: sale.amount,
        payments: dealPayments.get(`manual:${sale.id}`) ?? [],
        fee: sale.fee,
        createdAt: noon(sale.soldOn),
        dueOn: sale.dueOn,
        paymentDueAt: null,
        stageSince: sale.statusChangedAt,
        closedAt: sale.closedAt,
        campaignId: sale.campaignId,
        items: [],
      };
    }),
    ...requests
      .filter((request) => !takenRequests.has(request.number))
      .map(
        (request): WorkOrder => ({
          kind: "request",
          id: String(request.number),
          number: `№${request.number}`,
          type: "request",
          channel: "site",
          title:
            [
              request.productType,
              request.description?.split("\n").find((line) => line.trim()),
            ]
              .filter(Boolean)
              .join(": ")
              .slice(0, 200) || "Заявка с сайта",
          clientName: request.name ?? "Без имени",
          phone: null,
          email: null,
          clientKey: null,
          stage: "new",
          status: "request",
          amount: 0,
          payments: [],
          fee: 0,
          createdAt: request.createdAt,
          dueOn: null,
          paymentDueAt: null,
          stageSince: request.createdAt,
          closedAt: null,
          campaignId: null,
          items: [],
        }),
      ),
  ];

  return { ...crm, orders };
}

/** Где открыть заказ в админке. */
function orderHref(order: WorkOrder) {
  switch (order.kind) {
    case "product":
      return `/orders/${order.id}`;
    case "workshop":
      return `/workshop-orders?status=all&q=${encodeURIComponent(order.id)}`;
    case "manual":
      return `/crm/orders/${order.id}`;
    default:
      return `/requests/${order.id}`;
  }
}

/** Строка ленты для админки: суммы в рублях, просрочка и дни на этапе. */
function orderView(order: WorkOrder, today: string, now: Date) {
  return {
    kind: order.kind,
    id: order.id,
    number: order.number,
    type: order.type,
    channel: order.channel,
    title: order.title,
    clientName: order.clientName,
    phone: order.phone,
    email: order.email,
    clientKey: order.clientKey,
    stage: order.stage,
    status: order.status,
    amount: rubles(order.amount),
    paid: rubles(paidSum(order)),
    toCollect: rubles(toCollect(order)),
    fee: rubles(order.fee),
    createdAt: order.createdAt,
    dueOn: order.dueOn,
    paymentDueAt: order.paymentDueAt,
    closedAt: order.closedAt,
    overdue: isOverdue(order, today, now),
    daysOpen: daysSince(order.createdAt, now),
    daysInStage: order.stageSince ? daysSince(order.stageSince, now) : null,
    href: orderHref(order),
  };
}

export type WorkOrderView = ReturnType<typeof orderView>;

/** Сначала просроченные, затем ближайший срок, затем давние. */
function byUrgency(a: WorkOrderView, b: WorkOrderView) {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  if (a.dueOn !== b.dueOn) {
    if (!a.dueOn) return 1;
    if (!b.dueOn) return -1;
    return a.dueOn < b.dueOn ? -1 : 1;
  }
  return (
    a.createdAt.getTime() - b.createdAt.getTime() ||
    a.kind.localeCompare(b.kind) ||
    a.id.localeCompare(b.id)
  );
}

const periodOf = (input: { from?: string; to?: string }): Period => ({
  from: input.from ? moscowDay(input.from) : null,
  to: input.to ? new Date(moscowDay(input.to).getTime() + DAY) : null,
});

/**
 * Лента заказов. active — всё, что в работе (с заявками), по срочности;
 * all — все заказы, новые сверху, с фильтрами по этапу, площадке, виду,
 * дате оформления и поиском по номеру, клиенту, телефону и составу.
 *
 * @example client.admin.crm.orders({ view: "active" })
 */
export const orders = adminProcedure
  .input(
    z.object({
      view: z.enum(["active", "all"]).default("active"),
      stage: z.enum(STAGES).optional(),
      channel: z.enum(["site", ...ORDER_CHANNELS]).optional(),
      type: z.enum(TYPES).optional(),
      query: z.string().trim().max(100).optional(),
      from: daySchema.optional(),
      to: daySchema.optional(),
      limit: z.number().int().min(1).max(500).default(100),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, input }) => {
    const now = new Date();
    const today = toMoscowDay(now);
    const { orders: all } = await loadWork(context.db, now);
    const period = periodOf(input);

    const query = input.query?.toLowerCase().replace(/^№/, "");
    const digits = input.query?.replace(/\D/g, "") ?? "";
    const matches = (order: WorkOrder) =>
      !query ||
      order.title.toLowerCase().includes(query) ||
      order.clientName.toLowerCase().includes(query) ||
      order.number?.toLowerCase().replace(/^№/, "") === query ||
      order.number?.toLowerCase().includes(query) ||
      order.email?.includes(query) ||
      order.id === input.query ||
      (digits.length >= 4 && Boolean(order.phone?.includes(digits)));

    const scoped = all.filter(
      (order) =>
        (input.view === "all"
          ? order.kind !== "request"
          : isActive(order.stage)) &&
        (!input.channel || order.channel === input.channel) &&
        (!input.type || order.type === input.type) &&
        (!period.from || order.createdAt >= period.from) &&
        (!period.to || order.createdAt < period.to) &&
        matches(order),
    );

    // Счётчики этапов — до фильтра по этапу, чтобы переключатель их показывал
    const stages = STAGES.map((stage) => {
      const own = scoped.filter((order) => order.stage === stage);
      return {
        stage,
        count: own.length,
        amount: rubles(own.reduce((sum, order) => sum + order.amount, 0)),
        toCollect: rubles(own.reduce((sum, o) => sum + toCollect(o), 0)),
        overdue: own.filter((order) => isOverdue(order, today, now)).length,
      };
    });

    // Полные счётчики по источникам, независимо от этапа и страницы карточек.
    const kinds = (["product", "workshop", "manual", "request"] as const).map(
      (kind) => ({
        kind,
        count: scoped.filter((order) => order.kind === kind).length,
      }),
    );

    const found = scoped
      .filter((order) => !input.stage || order.stage === input.stage)
      .map((order) => orderView(order, today, now));
    found.sort(
      input.view === "active"
        ? byUrgency
        : (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    return {
      items: found.slice(input.offset, input.offset + input.limit),
      total: found.length,
      stages,
      kinds,
    };
  });

/** Заказ вне сайта со всеми оплатами, клиентом и списком рекламы для выбора. */
export const order = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const now = new Date();
    const crm = await loadCrm(context.db);
    const sale = crm.sales.find((row) => row.id === input.id);
    if (!sale) {
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });
    }
    const payments = await context.db
      .select()
      .from(crmSalePayments)
      .where(eq(crmSalePayments.saleId, sale.id))
      .orderBy(crmSalePayments.paidOn, crmSalePayments.createdAt);
    const client = findClient(crm.clients, sale.clientId);
    const paid = sale.status === "canceled" ? 0 : sumOf(payments);
    const stage = manualStage(sale.status);
    return {
      id: sale.id,
      soldOn: sale.soldOn,
      amount: rubles(sale.amount),
      description: sale.description,
      channel: sale.channel,
      status: sale.status,
      stage,
      externalNumber: sale.externalNumber,
      dueOn: sale.dueOn,
      trackingNumber: sale.trackingNumber,
      notes: sale.notes,
      fee: rubles(sale.fee),
      campaignId: sale.campaignId,
      requestNumber: sale.requestNumber,
      statusChangedAt: sale.statusChangedAt,
      closedAt: sale.closedAt,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      paid: rubles(paid),
      toCollect: isActive(stage) ? rubles(Math.max(0, sale.amount - paid)) : 0,
      overdue:
        isActive(stage) &&
        stage !== "shipped" &&
        sale.dueOn !== null &&
        sale.dueOn < toMoscowDay(now),
      payments: payments.map((payment) => ({
        id: payment.id,
        paidOn: payment.paidOn,
        amount: rubles(payment.amount),
        note: payment.note,
      })),
      client: client && {
        key: client.key,
        name: client.name,
        phones: client.phones,
        emails: client.emails,
        orders: client.deals.length,
        revenue: rubles(client.revenue),
      },
      campaigns: crm.campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        channel: campaign.channel,
        archived: campaign.archived,
      })),
    };
  });

const sumOf = (payments: { amount: number }[]) =>
  payments.reduce((sum, payment) => sum + payment.amount, 0);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const rubleAmount = z.number().min(0).max(21_474_836.47);

/** Поля заказа вне сайта, общие для создания и правки. */
export const orderFields = z.object({
  soldOn: daySchema,
  amount: rubleAmount,
  description: z.string().trim().min(1).max(300),
  channel: z.enum(ORDER_CHANNELS).default("other"),
  externalNumber: optionalText(100).default(null),
  dueOn: daySchema.nullable().default(null),
  trackingNumber: optionalText(200).default(null),
  notes: optionalText(4000).default(null),
  fee: rubleAmount.default(0),
  campaignId: z.string().min(1).nullable().default(null),
});

/** Кампания существует — иначе выручку некуда записать. */
export async function assertCampaign(db: Database, id: string | null) {
  if (!id) return;
  const [campaign] = await db
    .select({ id: adCampaigns.id })
    .from(adCampaigns)
    .where(eq(adCampaigns.id, id));
  if (!campaign) {
    throw new ORPCError("BAD_REQUEST", { message: "Кампания не найдена" });
  }
}

/** Колонки заказа из полей формы: суммы — в копейках. */
export const orderColumns = (input: z.infer<typeof orderFields>) => ({
  soldOn: input.soldOn,
  amount: toKopecks(input.amount),
  description: input.description,
  channel: input.channel,
  externalNumber: input.externalNumber,
  dueOn: input.dueOn,
  trackingNumber: input.trackingNumber,
  notes: input.notes,
  fee: toKopecks(input.fee),
  campaignId: input.campaignId,
});

/** Меняет всё, кроме этапа, клиента и оплат. */
export const updateOrder = adminProcedure
  .input(orderFields.extend({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    await assertCampaign(context.db, input.campaignId);
    const [updated] = await context.db
      .update(crmSales)
      .set(orderColumns(input))
      .where(eq(crmSales.id, input.id))
      .returning({ id: crmSales.id });
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });
    }
    return { id: updated.id };
  });

/** Переводит заказ на этап; выполненный и отменённый получают дату закрытия. */
export const setOrderStatus = adminProcedure
  .input(
    z.object({ id: z.string().min(1), status: z.enum(CRM_ORDER_STATUSES) }),
  )
  .handler(async ({ context, input }) => {
    const now = new Date();
    const closed = input.status === "done" || input.status === "canceled";
    const [updated] = await context.db
      .update(crmSales)
      .set({
        status: input.status,
        statusChangedAt: now,
        closedAt: closed ? now : null,
      })
      .where(eq(crmSales.id, input.id))
      .returning({ id: crmSales.id, status: crmSales.status });
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });
    }
    return updated;
  });

/** Записывает поступившие деньги: предоплату, доплату или всю сумму. */
export const addPayment = adminProcedure
  .input(
    z.object({
      saleId: z.string().min(1),
      paidOn: daySchema,
      amount: z.number().positive().max(21_474_836.47),
      note: optionalText(300).default(null),
    }),
  )
  .handler(async ({ context, input }) => {
    const [sale] = await context.db
      .select({ id: crmSales.id })
      .from(crmSales)
      .where(eq(crmSales.id, input.saleId));
    if (!sale) {
      throw new ORPCError("NOT_FOUND", { message: "Заказ не найден" });
    }
    const [payment] = await context.db
      .insert(crmSalePayments)
      .values({
        saleId: sale.id,
        paidOn: input.paidOn,
        amount: toKopecks(input.amount),
        note: input.note,
      })
      .returning({ id: crmSalePayments.id });
    return { id: payment?.id ?? null };
  });

export const removePayment = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [removed] = await context.db
      .delete(crmSalePayments)
      .where(eq(crmSalePayments.id, input.id))
      .returning({ id: crmSalePayments.id });
    if (!removed) {
      throw new ORPCError("NOT_FOUND", { message: "Оплата не найдена" });
    }
    return { id: removed.id };
  });

const totalsView = (row: SalesTotals) => ({
  placed: row.placed,
  canceled: row.canceled,
  paidOrders: row.paidOrders,
  revenue: rubles(row.revenue),
  fees: rubles(row.fees),
  net: rubles(row.revenue - row.fees),
  averageCheck:
    row.paidOrders > 0 ? rubles(row.paidOrdersAmount / row.paidOrders) : 0,
});

/**
 * Аналитика продаж за период: выручка, заказы и средний чек по площадкам и
 * видам заказов, помесячно за год, что сейчас в работе, лучшие товары,
 * новые и вернувшиеся покупатели. `to` — последний день включительно.
 *
 * @example client.admin.crm.analytics({ from: "2026-10-01", to: "2026-10-31" })
 */
export const analytics = adminProcedure
  .input(z.object({ from: daySchema.optional(), to: daySchema.optional() }))
  .handler(async ({ context, input }) => {
    const now = new Date();
    const today = toMoscowDay(now);
    const { orders: all, clients } = await loadWork(context.db, now);
    const period = periodOf(input);

    const byChannel = [...totalsBy(all, period, (o) => o.channel)]
      .map(([channel, row]) => ({ channel, ...totalsView(row) }))
      .filter((row) => row.placed + row.paidOrders + row.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue || b.placed - a.placed);
    const byType = [...totalsBy(all, period, (o) => o.type)]
      .filter(([type]) => type !== "request")
      .map(([type, row]) => ({ type, ...totalsView(row) }))
      .filter((row) => row.placed + row.paidOrders + row.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const months = lastMonths(now, 12).map(({ month, period: range }) => {
      const channels = totalsBy(all, range, (o) => o.channel);
      const sum = totals(all, range);
      return {
        month,
        revenue: rubles(sum.revenue),
        placed: sum.placed,
        paidOrders: sum.paidOrders,
        channels: Object.fromEntries(
          [...channels]
            .filter(([, row]) => row.revenue > 0)
            .map(([channel, row]) => [channel, rubles(row.revenue)]),
        ),
      };
    });

    const active = all.filter((o) => isActive(o.stage));
    const pipeline = ACTIVE_STAGES.map((stage) => {
      const own = active.filter((o) => o.stage === stage);
      return {
        stage,
        count: own.length,
        amount: rubles(own.reduce((sum, o) => sum + o.amount, 0)),
      };
    });

    const customers = newVsRepeat(clients, period);
    return {
      totals: totalsView(totals(all, period)),
      byChannel,
      byType,
      months,
      pipeline,
      inWork: {
        count: active.filter((o) => o.kind !== "request").length,
        requests: active.filter((o) => o.kind === "request").length,
        amount: rubles(
          active.reduce(
            (sum, o) => sum + (o.kind === "request" ? 0 : o.amount),
            0,
          ),
        ),
        toCollect: rubles(active.reduce((sum, o) => sum + toCollect(o), 0)),
        overdue: active.filter((o) => isOverdue(o, today, now)).length,
      },
      topItems: topItems(all, period).map((item) => ({
        ...item,
        revenue: rubles(item.revenue),
      })),
      customers: {
        newBuyers: customers.newBuyers,
        repeat: customers.repeat,
        newRevenue: rubles(customers.newRevenue),
        repeatRevenue: rubles(customers.repeatRevenue),
      },
    };
  });
