import type { productOrders } from "@stariva/db/schema";
import {
  ArrowLeftIcon,
  CheckIcon,
  MessageCircleIcon,
  ReceiptTextIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MadeToOrderPayment } from "@/app/order/[orderId]/made-to-order-payment";
import { ContactMasterButton } from "@/components/stariva/contact-master";
import { Button } from "@/components/ui/button";
import type { AccountOrder, AccountReceipt } from "@/lib/account/orders";
import { isPaymentOverdue } from "@/lib/commerce/made-to-order-flow";
import { describeMadeToOrderOptions } from "@/lib/commerce/made-to-order-options";
import { measurementFieldsBySlug } from "@/lib/commerce/measurement-fields";
import {
  madeToOrderHints,
  orderProgress,
  postingStatusLabels,
  stockOrderHints,
} from "@/lib/commerce/order-status";
import { getPostingStatuses } from "@/lib/ozon-delivery/postings";
import type { DeliveryCheckoutResponse } from "@/lib/ozon-delivery/types";
import { cn } from "@/lib/utils";
import {
  ItemImage,
  kindLabels,
  money,
  orderDateFormatter,
  ProgressSteps,
  StatusBadge,
} from "../order-ui";
import { AccountMadeToOrderDetails, PaidOrderTracker } from "./order-client";

type ProductOrderRow = typeof productOrders.$inferSelect;

const deliveryDays = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

function Card({
  id,
  title,
  children,
  className,
}: {
  id?: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "bg-white border border-espresso/10 rounded-2xl p-5",
        className,
      )}
    >
      {title && (
        <h3 className="label-caps text-[11px] text-taupe mb-3">{title}</h3>
      )}
      {children}
    </section>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 text-sm ${strong ? "font-medium" : ""}`}
    >
      <span className="text-espresso">{label}</span>
      <span className="text-espresso tabular-nums text-right">{value}</span>
    </div>
  );
}

function OrderHeader({ view }: { view: AccountOrder }) {
  return (
    <div className="space-y-3">
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1.5 text-sm text-taupe hover:text-espresso transition-colors"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Все заказы
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps text-[11px] text-taupe mb-1">
            {kindLabels[view.kind]}
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl text-espresso">
            {view.number ? `Заказ №${view.number}` : view.items[0]?.name}
          </h2>
          <p className="text-sm text-taupe mt-1">
            от {orderDateFormatter.format(view.createdAt)}
          </p>
        </div>
        <StatusBadge kind={view.kind} status={view.status} />
      </div>
    </div>
  );
}

/** После возврата из ЮKassa: webhook может прийти чуть позже редиректа. */
function PaymentReturnNotice({ awaiting }: { awaiting: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-espresso/10 bg-sand px-5 py-4 text-sm text-espresso">
      <CheckIcon className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
      <p>
        {awaiting
          ? "Спасибо! Проверяем оплату — статус заказа обновится в течение минуты. Обновите страницу чуть позже."
          : "Оплата получена. Спасибо!"}
      </p>
    </div>
  );
}

/** Чеки из «Мой налог» — открываются на сайте ФНС. */
function Receipts({ receipts }: { receipts: AccountReceipt[] }) {
  if (receipts.length === 0) return null;
  return (
    <ul className="border-t border-espresso/8 pt-3 mt-3 space-y-1.5">
      {receipts.map((receipt) => (
        <li key={receipt.number}>
          <a
            href={receipt.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-espresso hover:underline underline-offset-4"
          >
            <ReceiptTextIcon className="size-4 text-taupe" aria-hidden="true" />
            Чек №{receipt.number}
          </a>
        </li>
      ))}
    </ul>
  );
}

function ItemsList({ view }: { view: AccountOrder }) {
  return (
    <ul className="divide-y divide-espresso/8">
      {view.items.map((item) => {
        const name = item.href ? (
          <Link href={item.href} className="hover:underline underline-offset-4">
            {item.name}
          </Link>
        ) : (
          item.name
        );
        return (
          <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            <ItemImage
              src={item.image}
              alt={item.name}
              sizes="80px"
              className="w-16 h-20 sm:w-20 sm:h-24"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-espresso">{name}</p>
              {item.options && (
                <p className="text-xs text-taupe mt-1 leading-relaxed">
                  {describeMadeToOrderOptions({
                    ...item.options,
                    comment: undefined,
                  })}
                </p>
              )}
              <p className="text-xs text-taupe mt-1 tabular-nums">
                {item.quantity} × {money(item.price)}
              </p>
            </div>
            <p className="text-sm text-espresso tabular-nums whitespace-nowrap">
              {money(item.price * item.quantity)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function deliveryDetails(order: ProductOrderRow) {
  const raw = (order.deliveryAddress ?? {}) as Record<string, unknown>;
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value : null;
  const snapshot = order.checkoutSnapshot as DeliveryCheckoutResponse | null;
  const method = snapshot?.splits?.[0]?.deliveryMethod;

  const label =
    order.deliveryMethod === "manual"
      ? "Способ и стоимость согласует мастер"
      : order.deliveryMethod === "courier"
        ? "Курьером Ozon"
        : method?.type === "POSTAMAT"
          ? "Постамат Ozon"
          : "Пункт выдачи Ozon";

  let dates: string | null = null;
  if (method?.logisticDateFrom && method.logisticDateTo) {
    const from = new Date(method.logisticDateFrom);
    const to = new Date(method.logisticDateTo);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      dates = deliveryDays.formatRange(from, to);
    }
  }

  const title = text(raw.title);
  return {
    label,
    // Название пункта часто совпадает со способом доставки — не повторяем
    title: title === label ? null : title,
    address: text(raw.address),
    dates,
  };
}

export async function ProductOrderView({
  order,
  view,
  receipts,
  paymentReturn,
}: {
  order: ProductOrderRow;
  view: AccountOrder;
  receipts: AccountReceipt[];
  paymentReturn: boolean;
}) {
  const madeToOrder = order.kind === "made_to_order";
  const progress = orderProgress(view.kind, order.status);
  const canEditDetails = madeToOrder && order.status === "requested";
  const [postings, measurementFields] = await Promise.all([
    getPostingStatuses(order.ozonPostingNumbers),
    canEditDetails
      ? measurementFieldsBySlug(view.items.map((item) => item.productSlug))
      : null,
  ]);
  const delivery = deliveryDetails(order);
  const settled = ["delivered", "canceled", "refunded", "declined"].includes(
    order.status,
  );
  const hint =
    order.status === "declined"
      ? `Мастер не сможет выполнить этот заказ${order.declineReason ? `: ${order.declineReason}` : "."}`
      : (madeToOrder ? madeToOrderHints : stockOrderHints)[order.status];
  const awaitingPayment =
    view.paymentStep !== null || order.status === "pending";

  return (
    <div className="space-y-6">
      <OrderHeader view={view} />
      <PaidOrderTracker
        orderId={order.id}
        amountKopecks={order.amountTotal}
        paid={Boolean(order.paidAt)}
      />
      {paymentReturn && <PaymentReturnNotice awaiting={awaitingPayment} />}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {(progress || hint) && (
            <Card>
              {progress && <ProgressSteps progress={progress} />}
              {hint && (
                <p
                  className={`rounded-xl bg-sand px-4 py-3 text-sm text-espresso leading-relaxed ${progress ? "mt-5" : ""}`}
                >
                  {hint}
                </p>
              )}
              {view.paymentStep && (
                // На телефоне блок оплаты ниже состава заказа — ведём сразу к нему
                <Button
                  asChild
                  className="mt-4 w-full bg-espresso text-parchment hover:bg-espresso/90 lg:hidden"
                >
                  <a href="#payment">
                    Оплатить{" "}
                    {view.paymentStep.type === "deposit"
                      ? "предоплату"
                      : "доплату"}{" "}
                    {money(view.paymentStep.amount)}
                  </a>
                </Button>
              )}
            </Card>
          )}

          <Card title={`Состав заказа · ${view.items.length}`}>
            <ItemsList view={view} />
          </Card>

          {canEditDetails && measurementFields && (
            <Card title="Мерки и пожелания">
              <AccountMadeToOrderDetails
                orderId={order.id}
                phone={order.contactPhone}
                items={view.items.map((item) => ({
                  id: item.id,
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price,
                  options: item.options,
                  measurementFields:
                    measurementFields.get(item.productSlug) ?? [],
                }))}
                customerNotes={order.customerNotes}
                deliveryNote={order.deliveryNote}
              />
            </Card>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24">
          <Card id="payment" title="Оплата" className="scroll-mt-24">
            {madeToOrder ? (
              // Блок оплаты рассчитан на гостевую страницу, где над ним список изделий
              <div className="[&>div:first-child]:border-t-0 [&>div:first-child]:pt-0">
                <MadeToOrderPayment
                  orderId={order.id}
                  phone={order.contactPhone}
                  returnTo="account"
                  terms={{
                    number: order.number,
                    status: order.status,
                    paid: Boolean(order.paidAt),
                    amountTotal: order.amountTotal,
                    amountDelivery: order.amountDelivery,
                    amountProducts: order.amountProducts,
                    depositAmount: order.depositAmount,
                    depositPaid: Boolean(order.depositPaidAt),
                    leadTime: order.leadTime,
                    paymentDueAt: order.paymentDueAt?.toISOString() ?? null,
                    paymentOverdue: isPaymentOverdue(order),
                    paymentStep: view.paymentStep,
                  }}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <SummaryRow
                  label="Изделия"
                  value={money(order.amountProducts)}
                />
                <SummaryRow
                  label="Доставка"
                  value={
                    order.amountDelivery > 0
                      ? money(order.amountDelivery)
                      : "Бесплатно"
                  }
                />
                <div className="border-t border-espresso/8 pt-2 mt-2">
                  <SummaryRow
                    label="Итого"
                    value={money(order.amountTotal)}
                    strong
                  />
                </div>
                {order.paidAt && (
                  <p className="flex items-center gap-1.5 pt-1 text-xs text-taupe">
                    <CheckIcon className="size-3.5" aria-hidden="true" />
                    Оплачено {orderDateFormatter.format(order.paidAt)}
                  </p>
                )}
              </div>
            )}
            <Receipts receipts={receipts} />
          </Card>

          <Card title="Доставка">
            <div className="space-y-2 text-sm">
              <p className="text-espresso">{delivery.label}</p>
              {(delivery.title || delivery.address) && (
                <p className="text-taupe leading-relaxed">
                  {[delivery.title, delivery.address]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              {delivery.dates && !settled && (
                <p className="text-taupe">
                  Ожидаемая доставка:{" "}
                  <span className="text-espresso">{delivery.dates}</span>
                </p>
              )}
              {order.deliveryNote && !canEditDetails && (
                <p className="text-taupe leading-relaxed">
                  Куда отправить:{" "}
                  <span className="text-espresso">{order.deliveryNote}</span>
                </p>
              )}
              {order.trackingNumber && (
                <div className="rounded-xl bg-sand px-3 py-2">
                  <p className="text-xs text-taupe">Трек-номер</p>
                  <p className="text-espresso select-all">
                    {order.trackingNumber}
                  </p>
                </div>
              )}
              {postings.length > 0 && (
                <div className="border-t border-espresso/8 pt-2 space-y-1">
                  {postings.map((posting) => (
                    <div
                      key={posting.postingNumber}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-taupe select-all">
                        {posting.postingNumber}
                      </span>
                      <span className="text-espresso">
                        {postingStatusLabels[posting.status] ??
                          "Статус уточняется"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card title="Получатель">
            <div className="space-y-0.5 text-sm">
              <p className="text-espresso">{order.contactName}</p>
              <p className="text-taupe">{order.contactPhone}</p>
              {order.contactEmail && (
                <p className="text-taupe break-all">{order.contactEmail}</p>
              )}
            </div>
          </Card>

          <HelpCard number={order.number} />
        </aside>
      </div>
    </div>
  );
}

function HelpCard({ number }: { number: number | null }) {
  return (
    <Card>
      <p className="text-sm text-espresso mb-1">Вопрос по заказу?</p>
      <p className="text-xs text-taupe mb-3">
        Ольга ответит в мессенджере или по телефону.
      </p>
      <Button asChild variant="outline" className="w-full">
        <ContactMasterButton
          source="account_order"
          message={
            number
              ? `Здравствуйте, Ольга! Вопрос по заказу №${number}.`
              : "Здравствуйте, Ольга! Вопрос по мастер-классу."
          }
        >
          <MessageCircleIcon aria-hidden="true" />
          Написать мастеру
        </ContactMasterButton>
      </Button>
    </Card>
  );
}

export function WorkshopOrderView({
  view,
  receipts,
  paymentReturn,
}: {
  view: AccountOrder;
  receipts: AccountReceipt[];
  paymentReturn: boolean;
}) {
  const item = view.items[0];
  const slug = view.workshopSlug;
  return (
    <div className="space-y-6">
      <OrderHeader view={view} />
      {paymentReturn && (
        <PaymentReturnNotice awaiting={view.status === "pending"} />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        <Card className="overflow-hidden p-0">
          {item && (
            <ItemImage
              src={item.image}
              alt={item.name}
              sizes="(max-width: 1024px) 100vw, 600px"
              className="aspect-[16/9] w-full rounded-none"
            />
          )}
          <div className="p-5 space-y-4">
            <p className="text-sm text-espresso">
              {view.status === "paid"
                ? "Курс доступен в разделе «Мои мастер-классы» — смотрите уроки в любое время."
                : view.status === "pending"
                  ? "Заказ ждёт оплаты. Если вы закрыли страницу оплаты, оформите покупку заново."
                  : "Заказ закрыт, доступа к курсу по нему нет."}
            </p>
            {slug && (
              <div className="flex flex-wrap gap-3">
                {view.status === "paid" ? (
                  <Button
                    asChild
                    className="bg-espresso text-parchment hover:bg-espresso/90"
                  >
                    <Link href={`/account/workshops/${slug}`}>
                      Перейти к курсу
                    </Link>
                  </Button>
                ) : (
                  view.status === "pending" && (
                    <Button
                      asChild
                      className="bg-espresso text-parchment hover:bg-espresso/90"
                    >
                      <Link href={`/workshops/${slug}`}>Оплатить</Link>
                    </Button>
                  )
                )}
                {item?.href && (
                  <Button asChild variant="outline">
                    <Link href={item.href}>Страница мастер-класса</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        <aside className="space-y-5">
          <Card title="Оплата">
            <div className="space-y-1.5">
              <SummaryRow
                label="Итого"
                value={money(view.amountTotal)}
                strong
              />
              {view.paidAt && (
                <p className="flex items-center gap-1.5 pt-1 text-xs text-taupe">
                  <CheckIcon className="size-3.5" aria-hidden="true" />
                  Оплачено {orderDateFormatter.format(view.paidAt)}
                </p>
              )}
            </div>
            <Receipts receipts={receipts} />
          </Card>
          <HelpCard number={null} />
        </aside>
      </div>
    </div>
  );
}
