import {
  adCampaigns,
  adExpenses,
  crmClients,
  crmSalePayments,
  crmSales,
  type Database,
  eq,
  orders,
  productOrderPayments,
  productOrders,
  user,
  workshops,
} from "@stariva/db";

import {
  buildClients,
  type Deal,
  moscowDay,
  normalizeEmail,
  normalizePhone,
} from "./model";

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
  ]);

  const paymentsByOrder = new Map<string, Deal["payments"]>();
  for (const payment of paymentRows) {
    const list = paymentsByOrder.get(payment.orderId) ?? [];
    list.push({
      at: payment.paidAt ?? payment.createdAt,
      amount: payment.amount,
    });
    paymentsByOrder.set(payment.orderId, list);
  }

  // Полдень, чтобы день не съехал при переводе часовых поясов
  const noon = (day: string) =>
    new Date(moscowDay(day).getTime() + 12 * 3600_000);
  const paymentsBySale = new Map<string, Deal["payments"]>();
  for (const payment of salePaymentRows) {
    const list = paymentsBySale.get(payment.saleId) ?? [];
    list.push({ at: noon(payment.paidOn), amount: payment.amount });
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
        createdAt: noon(sale.soldOn),
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
  };
}

export type CrmData = Awaited<ReturnType<typeof loadCrm>>;
