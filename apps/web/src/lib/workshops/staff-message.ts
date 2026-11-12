import type { orders, WorkshopRow } from "@stariva/db/schema";
import { formatTouch } from "@/lib/campaign-attribution";
import type { OrderMessage } from "@/lib/commerce/order-message";
import { formatPrice } from "@/lib/products";
import { formatReleaseDateTime } from "@/lib/workshops-data";
import { getBundle } from "./bundles";

type OrderRow = typeof orders.$inferSelect;

/** Мастеру: купили мастер-класс. Доступ покупатель уже получил, действий не нужно. */
export function formatWorkshopPurchaseMessage(
  order: OrderRow,
  workshop: Pick<WorkshopRow, "title" | "releaseAt">,
  email: string,
  now = new Date(),
): OrderMessage {
  const release =
    workshop.releaseAt && workshop.releaseAt > now ? workshop.releaseAt : null;
  // Код с Ярмарки: курс оплачен там, на сайте его только активировали
  const fromLivemaster = order.attribution?.last.utm_source === "livemaster";
  // Мастер-класс из набора оплачен в цене набора — цены у заказа нет.
  // kit — набор куплен на сайте, ozon — код с купона в коробке с Ozon
  const source = order.attribution?.last.utm_source;
  const price = formatPrice(order.amount / 100);
  const bundle = getBundle(order.bundleSlug);
  return {
    title:
      source === "kit"
        ? `Открыт мастер-класс к набору: «${workshop.title}»`
        : source === "ozon"
          ? `Активирован код из набора с Ozon: «${workshop.title}»`
          : fromLivemaster
            ? `Активирован код с Ярмарки Мастеров: «${workshop.title}» · ${price}`
            : bundle
              ? `Куплено комбо «${bundle.title}» · ${price}`
              : `Куплен мастер-класс «${workshop.title}» · ${price}`,
    message: [
      `Email: ${order.contactEmail ?? email}`,
      release &&
        `Предзаказ: уроки откроются ${formatReleaseDateTime(release.toISOString())}`,
      order.attribution && `Источник: ${formatTouch(order.attribution.last)}`,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n"),
  };
}
