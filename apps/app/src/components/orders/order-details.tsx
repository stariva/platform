import { Badge, Card, CardContent, CardHeader, CardTitle } from "@stariva/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProductThumb } from "~/components/products/product-thumb";
import {
  type AdminOrderView,
  DELIVERY_METHOD_LABELS,
  dateTime,
  OZON_DELIVERY_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  productSiteUrl,
  rubles,
  SHIPMENT_STATUS_LABELS,
} from "./order-meta";

const day = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });

/** Подпись и значение; пустое значение не показываем. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  if (children === null || children === undefined || children === "") {
    return null;
  }
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

const mapUrl = ({ lat, lng }: { lat: number; lng: number }) =>
  `https://yandex.ru/maps/?pt=${lng},${lat}&z=16&l=map`;

/** Изделия заказа: фото из каталога, параметры и мерки. */
export function OrderItemsCard({ order }: { order: AdminOrderView }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Изделия</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {order.items.map((item) => (
          <div key={item.id} className="flex gap-3 rounded-lg border p-3">
            <ProductThumb src={item.image} />
            <div className="min-w-0 flex-1 space-y-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">
                  {item.productId ? (
                    <Link
                      href={`/products/${item.productId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {item.name}
                    </Link>
                  ) : (
                    item.name
                  )}
                </span>
                <span className="tabular-nums">
                  {item.quantity > 1 &&
                    `${item.quantity} × ${rubles.format(item.price)} = `}
                  <span className="font-medium">
                    {rubles.format(item.price * item.quantity)}
                  </span>
                </span>
              </div>
              <div className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
                <a
                  href={productSiteUrl(item.productSlug)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  на сайте ↗
                </a>
                {!item.productId && <span>товара больше нет в каталоге</span>}
                {item.ozonSku !== null && <span>SKU Ozon {item.ozonSku}</span>}
              </div>
              {item.options && (
                <dl className="grid gap-2 sm:grid-cols-2">
                  <Field label="Размер">{item.options.size}</Field>
                  <Field label="Цвет">{item.options.color}</Field>
                  {item.options.measurements.map((m) => (
                    <Field key={m.label} label={m.label}>
                      {`${m.value} см`}
                    </Field>
                  ))}
                  {item.options.comment && (
                    <div className="sm:col-span-2">
                      <Field label="Комментарий к изделию">
                        {item.options.comment}
                      </Field>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </div>
        ))}

        <dl className="space-y-1 border-t pt-3 text-sm">
          <SumLine label="Изделия">
            {rubles.format(order.amountProducts)}
          </SumLine>
          <SumLine label="Доставка">
            {order.amountDelivery > 0
              ? rubles.format(order.amountDelivery)
              : order.kind === "made_to_order"
                ? "ещё не согласована"
                : "бесплатно"}
          </SumLine>
          {order.depositAmount !== null && (
            <SumLine label="Предоплата">
              {rubles.format(order.depositAmount)}
            </SumLine>
          )}
          <SumLine label="Итого" strong>
            {rubles.format(order.amountTotal)}
          </SumLine>
        </dl>
      </CardContent>
    </Card>
  );
}

function SumLine({
  label,
  strong,
  children,
}: {
  label: string;
  strong?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${strong ? "font-medium" : ""}`}
    >
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}

/** Куда и как едет заказ: адрес или пункт выдачи, сроки и отправление. */
export function OrderDeliveryCard({ order }: { order: AdminOrderView }) {
  const { address, title, locality, coordinates } = order.deliveryAddress;
  const ozon = order.ozonDelivery;
  const ozonDates =
    ozon?.dateFrom && ozon.dateTo
      ? ozon.dateFrom.slice(0, 10) === ozon.dateTo.slice(0, 10)
        ? day.format(new Date(ozon.dateFrom))
        : `${day.format(new Date(ozon.dateFrom))} — ${day.format(new Date(ozon.dateTo))}`
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Доставка</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Способ">
            {DELIVERY_METHOD_LABELS[order.deliveryMethod]}
            {ozon?.type &&
              ` · ${OZON_DELIVERY_TYPE_LABELS[ozon.type] ?? ozon.type}`}
          </Field>
          {ozonDates && (
            <Field label="Передача в доставку по оценке Ozon">
              {ozonDates}
            </Field>
          )}
          {order.deliveryMethod !== "manual" && (
            <div className="sm:col-span-2">
              <Field
                label={
                  order.deliveryMethod === "pickup"
                    ? "Пункт выдачи"
                    : "Адрес доставки"
                }
              >
                {address ? (
                  <>
                    {title && !address.includes(title) && `${title}\n`}
                    {locality && !address.includes(locality) && `${locality}, `}
                    {address}
                    {coordinates && (
                      <>
                        {" · "}
                        <a
                          href={mapUrl(coordinates)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-4"
                        >
                          на карте
                        </a>
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    адрес не сохранён
                    {order.deliveryPointId &&
                      ` — пункт Ozon № ${order.deliveryPointId}`}
                  </span>
                )}
              </Field>
            </div>
          )}
          {order.deliveryPointId && address && (
            <Field label="ID пункта Ozon">{order.deliveryPointId}</Field>
          )}
          {order.deliveryNote && (
            <div className="sm:col-span-2">
              <Field label="Куда и как отправить — со слов покупателя">
                {order.deliveryNote}
              </Field>
            </div>
          )}
          <Field label="Отправление">{order.trackingNumber}</Field>
          {order.kind === "stock" && (
            <>
              <Field label="Заказ в Ozon Доставка">
                {order.ozonOrderId ??
                  SHIPMENT_STATUS_LABELS[order.ozonShipmentStatus]}
              </Field>
              {order.ozonPostingNumbers.length > 0 && (
                <Field label="Отправления Ozon">
                  {order.ozonPostingNumbers.join(", ")}
                </Field>
              )}
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

const PAYMENT_TYPE_LABELS = { deposit: "Предоплата", balance: "Доплата" };

/** Все попытки оплаты через ЮKassa, включая неоплаченные ссылки. */
export function OrderPaymentsCard({ order }: { order: AdminOrderView }) {
  if (order.payments.length === 0 && !order.paymentId) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Оплаты</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {order.paymentId && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span>
              Оплата заказа {rubles.format(order.amountTotal)}
              <Badge
                variant={order.paidAt ? "secondary" : "outline"}
                className="ml-2"
              >
                {order.paidAt ? "оплачено" : "не оплачено"}
              </Badge>
            </span>
            <span className="text-muted-foreground font-mono text-xs">
              ЮKassa {order.paymentId}
            </span>
          </div>
        )}
        {order.payments.map((payment) => (
          <div
            key={payment.id}
            className="flex flex-wrap items-baseline justify-between gap-x-3"
          >
            <span>
              {PAYMENT_TYPE_LABELS[payment.type]}{" "}
              {rubles.format(payment.amount)}
              <Badge
                variant={
                  payment.status === "succeeded" ? "secondary" : "outline"
                }
                className="ml-2"
              >
                {PAYMENT_STATUS_LABELS[payment.status]}
              </Badge>
            </span>
            <span className="text-muted-foreground text-xs">
              {payment.paidAt
                ? `оплачено ${dateTime.format(new Date(payment.paidAt))}`
                : `ссылка от ${dateTime.format(new Date(payment.createdAt))}`}
              {payment.yookassaPaymentId && (
                <span className="ml-2 font-mono">
                  ЮKassa {payment.yookassaPaymentId}
                </span>
              )}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** UTM-метки и сайт, с которого пришли, для первого и последнего захода до заказа. */
export function OrderAttributionCard({ order }: { order: AdminOrderView }) {
  const attribution = order.attribution;
  if (!attribution) return null;
  const touches = [
    ["Первый заход", attribution.first],
    ["Последний заход", attribution.last],
  ] as const;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Источник</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          {touches.map(([label, touch]) => (
            <Field key={label} label={label}>
              {[
                [touch.utm_source, touch.utm_medium, touch.utm_campaign]
                  .filter(Boolean)
                  .join(" / "),
                touch.utm_content && `объявление: ${touch.utm_content}`,
                touch.utm_term && `запрос: ${touch.utm_term}`,
                `страница: ${touch.landing}`,
                touch.referrer && `пришёл с ${touch.referrer}`,
                dateTime.format(new Date(touch.at)),
              ]
                .filter(Boolean)
                .join("\n")}
            </Field>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
