import { db } from "@stariva/db";
import {
  type MadeToOrderItemOptions,
  orderReceipts,
  orders,
  productOrderItems,
  productOrders,
} from "@stariva/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getProductsResult } from "@/lib/catalog/service";
import {
  type MadeToOrderPaymentType,
  madeToOrderPaymentStep,
} from "@/lib/commerce/made-to-order-flow";
import type { OrderKind } from "@/lib/commerce/order-status";
import { productHref } from "@/lib/products";
import { getWorkshopsBySlugs } from "@/lib/workshops/workshops-db";

type ProductOrderRow = typeof productOrders.$inferSelect;
type ProductOrderItemRow = typeof productOrderItems.$inferSelect;
type WorkshopOrderRow = typeof orders.$inferSelect;

export interface AccountOrderItem {
  id: string;
  productSlug: string;
  name: string;
  image: string | null;
  /** Страница изделия или курса; null — его уже сняли с витрины. */
  href: string | null;
  quantity: number;
  /** Цена за единицу в копейках на момент заказа. */
  price: number;
  options: MadeToOrderItemOptions | null;
}

/** Заказ в кабинете: мастер-класс или изделие — в одном виде для списка. */
export interface AccountOrder {
  id: string;
  kind: OrderKind;
  /** Номер заказа изделий; у мастер-классов номера нет. */
  number: number | null;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
  /** В копейках. */
  amountTotal: number;
  items: AccountOrderItem[];
  /** Что оплатить прямо сейчас (под заказ: предоплата или доплата). */
  paymentStep: { type: MadeToOrderPaymentType; amount: number } | null;
  /** Мастер-класс: slug курса — для «Перейти к курсу» и повторной оплаты. */
  workshopSlug: string | null;
}

interface CatalogEntry {
  image: string | null;
  href: string;
}

/** Фото и ссылки изделий из каталога: в заказе хранится только снапшот названия и цены. */
async function catalogBySlug(): Promise<Map<string, CatalogEntry>> {
  const { products } = await getProductsResult();
  return new Map(
    products.map((product) => [
      product.slug,
      {
        image: product.images[0] ?? null,
        href: productHref(product),
      },
    ]),
  );
}

function productOrderView(
  order: ProductOrderRow,
  items: ProductOrderItemRow[],
  catalog: Map<string, CatalogEntry>,
): AccountOrder {
  return {
    id: order.id,
    kind: order.kind,
    number: order.number,
    status: order.status,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    amountTotal: order.amountTotal,
    items: items.map((item) => {
      const entry = catalog.get(item.productSlug);
      return {
        id: item.id,
        productSlug: item.productSlug,
        name: item.name,
        image: entry?.image ?? null,
        href: entry?.href ?? null,
        quantity: item.quantity,
        price: item.price,
        options: item.options ?? null,
      };
    }),
    paymentStep: madeToOrderPaymentStep(order),
    workshopSlug: null,
  };
}

async function workshopOrderViews(
  rows: WorkshopOrderRow[],
): Promise<AccountOrder[]> {
  const workshops = await getWorkshopsBySlugs([
    ...new Set(rows.map((row) => row.workshopSlug)),
  ]);
  return rows.map((order) => {
    const workshop = workshops.get(order.workshopSlug);
    return {
      id: order.id,
      kind: "workshop",
      number: null,
      status: order.status,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      amountTotal: order.amount,
      items: [
        {
          id: order.id,
          productSlug: order.workshopSlug,
          name: workshop?.title ?? order.workshopSlug,
          image: workshop?.cover ?? null,
          href: workshop ? `/workshops/${workshop.slug}` : null,
          quantity: 1,
          price: order.amount,
          options: null,
        },
      ],
      paymentStep: null,
      workshopSlug: order.workshopSlug,
    };
  });
}

async function itemsByOrderId(
  orderIds: string[],
): Promise<Map<string, ProductOrderItemRow[]>> {
  const byOrder = new Map<string, ProductOrderItemRow[]>();
  if (orderIds.length === 0) return byOrder;
  const items = await db
    .select()
    .from(productOrderItems)
    .where(inArray(productOrderItems.orderId, orderIds));
  for (const item of items) {
    const list = byOrder.get(item.orderId) ?? [];
    list.push(item);
    byOrder.set(item.orderId, list);
  }
  return byOrder;
}

/** Все заказы покупателя — мастер-классы и изделия, новые сверху. */
export async function listAccountOrders(
  userId: string,
): Promise<AccountOrder[]> {
  const [workshopRows, productRows, catalog] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt)),
    db
      .select()
      .from(productOrders)
      .where(eq(productOrders.userId, userId))
      .orderBy(desc(productOrders.createdAt)),
    catalogBySlug(),
  ]);

  const items = await itemsByOrderId(productRows.map((order) => order.id));
  const all = [
    ...(await workshopOrderViews(workshopRows)),
    ...productRows.map((order) =>
      productOrderView(order, items.get(order.id) ?? [], catalog),
    ),
  ];
  return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Чек НПД из «Мой налог», привязанный к заказу. */
export interface AccountReceipt {
  number: string;
  /** Картинка чека на сайте ФНС. */
  url: string;
}

export type AccountOrderDetails = { receipts: AccountReceipt[] } & (
  | { kind: "workshop"; view: AccountOrder; order: WorkshopOrderRow }
  | { kind: "product"; view: AccountOrder; order: ProductOrderRow }
);

async function receiptsOf(
  column:
    | typeof orderReceipts.productOrderId
    | typeof orderReceipts.workshopOrderId,
  orderId: string,
): Promise<AccountReceipt[]> {
  return db
    .select({ number: orderReceipts.number, url: orderReceipts.url })
    .from(orderReceipts)
    .where(eq(column, orderId))
    .orderBy(asc(orderReceipts.createdAt));
}

/** Заказ покупателя по id; чужой или несуществующий — null. */
export async function getAccountOrder(
  userId: string,
  orderId: string,
): Promise<AccountOrderDetails | null> {
  const [productOrder] = await db
    .select()
    .from(productOrders)
    .where(and(eq(productOrders.id, orderId), eq(productOrders.userId, userId)))
    .limit(1);
  if (productOrder) {
    const [items, catalog, receipts] = await Promise.all([
      itemsByOrderId([productOrder.id]),
      catalogBySlug(),
      receiptsOf(orderReceipts.productOrderId, productOrder.id),
    ]);
    return {
      kind: "product",
      receipts,
      order: productOrder,
      view: productOrderView(
        productOrder,
        items.get(productOrder.id) ?? [],
        catalog,
      ),
    };
  }

  const [workshopOrder] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  if (!workshopOrder) return null;
  const [[view], receipts] = await Promise.all([
    workshopOrderViews([workshopOrder]),
    receiptsOf(orderReceipts.workshopOrderId, workshopOrder.id),
  ]);
  return view
    ? { kind: "workshop", order: workshopOrder, view, receipts }
    : null;
}
