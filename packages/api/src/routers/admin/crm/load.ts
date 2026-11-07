import {
  adCampaigns,
  adExpenses,
  crmClients,
  crmSalePayments,
  crmSales,
  type Database,
  eq,
  financeSettings,
  orderCosts,
  orders,
  productOrderPayments,
  productOrders,
  user,
  workshops,
} from "@stariva/db";

import { DEFAULT_RATES, type FinanceRates } from "./economics";
import {
  buildClients,
  type Deal,
  moscowNoon,
  normalizeEmail,
  normalizePhone,
} from "./model";
import type { CostLine } from "./work";

const emails = (...values: (string | null)[]) => [
  ...new Set(values.map(normalizeEmail).filter((v): v is string => !!v)),
];

/**
 * Всё, из чего складываются клиенты и сводка. Заказов сотни,
 * поэтому склейка и подсчёт идут в памяти, а не в SQL.
 */
export async function loadCrm(db: Database) {
  const [
    campaigns,
    expenses,
    records,
    sales,
    salePaymentRows,
    productRows,
    paymentRows,
    workshopRows,
    costRows,
    settingsRows,
  ] = await Promise.all([
    db.select().from(adCampaigns).orderBy(adCampaigns.createdAt),
    db.select().from(adExpenses),
    db.select().from(crmClients),
    db.select().from(crmSales),
    db.select().from(crmSalePayments),
    db
      .select({
        id: productOrders.id,
        number: productOrders.number,
        kind: productOrders.kind,
        status: productOrders.status,
        userId: productOrders.userId,
        contactName: productOrders.contactName,
        contactPhone: productOrders.contactPhone,
        contactEmail: productOrders.contactEmail,
        amountDelivery: productOrders.amountDelivery,
        amountTotal: productOrders.amountTotal,
        createdAt: productOrders.createdAt,
        paidAt: productOrders.paidAt,
        paymentDueAt: productOrders.paymentDueAt,
        approvedAt: productOrders.approvedAt,
        depositPaidAt: productOrders.depositPaidAt,
        attribution: productOrders.attribution,
        requestNumber: productOrders.requestNumber,
      })
      .from(productOrders),
    db
      .select({
        orderId: productOrderPayments.orderId,
        amount: productOrderPayments.amount,
        createdAt: productOrderPayments.createdAt,
        paidAt: productOrderPayments.paidAt,
      })
      .from(productOrderPayments)
      .where(eq(productOrderPayments.status, "succeeded")),
    db
      .select({
        id: orders.id,
        workshopSlug: orders.workshopSlug,
        workshopTitle: workshops.title,
        status: orders.status,
        amount: orders.amount,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        contactEmail: orders.contactEmail,
        attribution: orders.attribution,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
      })
      .from(orders)
      .innerJoin(user, eq(user.id, orders.userId))
      .leftJoin(workshops, eq(workshops.slug, orders.workshopSlug)),
    db.select().from(orderCosts),
    db.select().from(financeSettings),
  ]);

  const rates: FinanceRates = settingsRows[0]
    ? {
        acquiring: settingsRows[0].acquiringRate,
        tax: settingsRows[0].taxRate,
      }
    : DEFAULT_RATES;

  // Ключ — `product:<id>` или `manual:<id>`, как у сделок
  const costLines = new Map<string, CostLine[]>();
  for (const row of costRows) {
    const key = row.saleId
      ? `manual:${row.saleId}`
      : `product:${row.productOrderId}`;
    const list = costLines.get(key) ?? [];
    list.push({
      id: row.id,
      category: row.category,
      spentOn: row.spentOn,
      amount: row.amount,
      note: row.note,
    });
    costLines.set(key, list);
  }

  const paymentsByOrder = new Map<string, Deal["payments"]>();
  for (const payment of paymentRows) {
    const list = paymentsByOrder.get(payment.orderId) ?? [];
    list.push({
      at: payment.paidAt ?? payment.createdAt,
      amount: payment.amount,
    });
    paymentsByOrder.set(payment.orderId, list);
  }

  const paymentsBySale = new Map<string, Deal["payments"]>();
  for (const payment of salePaymentRows) {
    const list = paymentsBySale.get(payment.saleId) ?? [];
    // Полдень, чтобы день не съехал при переводе часовых поясов
    list.push({ at: moscowNoon(payment.paidOn), amount: payment.amount });
    paymentsBySale.set(payment.saleId, list);
  }

  const deals: Deal[] = [
    ...productRows.map((order): Deal => {
      let payments: Deal["payments"] = [];
      if (order.status !== "refunded") {
        // Под заказ платят частями — каждая оплата своей строкой; готовое — сразу
        payments =
          order.kind === "made_to_order"
            ? (paymentsByOrder.get(order.id) ?? [])
            : order.paidAt
              ? [{ at: order.paidAt, amount: order.amountTotal }]
              : [];
      }
      return {
        kind: "product",
        id: order.id,
        label: `Заказ №${order.number}`,
        status: order.status,
        createdAt: order.createdAt,
        payments,
        attribution: order.attribution,
        name: order.contactName,
        phone: normalizePhone(order.contactPhone),
        emails: emails(order.contactEmail),
        userId: order.userId,
        clientId: null,
        campaignId: null,
      };
    }),
    ...workshopRows.map(
      (order): Deal => ({
        kind: "workshop",
        id: order.id,
        label: order.workshopTitle ?? order.workshopSlug,
        status: order.status,
        createdAt: order.createdAt,
        payments:
          order.status === "paid"
            ? [{ at: order.paidAt ?? order.createdAt, amount: order.amount }]
            : [],
        attribution: order.attribution,
        name: order.userName,
        phone: null,
        emails: emails(order.userEmail, order.contactEmail),
        userId: order.userId,
        clientId: null,
        campaignId: null,
      }),
    ),
    ...sales.map(
      (sale): Deal => ({
        kind: "manual",
        id: sale.id,
        label: sale.description,
        status: sale.status,
        createdAt: moscowNoon(sale.soldOn),
        // Отменённый заказ не приносит денег: оплата считается возвращённой
        payments:
          sale.status === "canceled" ? [] : (paymentsBySale.get(sale.id) ?? []),
        attribution: null,
        name: null,
        phone: null,
        emails: [],
        userId: null,
        clientId: sale.clientId,
        campaignId: sale.campaignId,
      }),
    ),
  ];

  const clients = buildClients(deals, records, campaigns);
  return {
    campaigns,
    expenses,
    records,
    sales,
    clients,
    deals,
    productRows,
    workshopRows,
    paymentsBySale,
    costLines,
    rates,
  };
}

export type CrmData = Awaited<ReturnType<typeof loadCrm>>;
