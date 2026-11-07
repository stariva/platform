"use client";

import type { OrderView } from "@stariva/web-api/contract";
import { CheckIcon, MessageCircleIcon, RotateCwIcon } from "lucide-react";
import Link from "next/link";
import { type CSSProperties, type ReactNode, useId } from "react";
import { money } from "@/app/account/orders/order-ui";
import { ContactMasterButton } from "@/components/stariva/contact-master";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  formatDateRange,
  localDateKey,
  pickupPointAddressLine,
} from "@/lib/ozon-delivery/format";
import { cn } from "@/lib/utils";

/**
 * Экраны после возврата из ЮKassa. Что именно показать, решает
 * paymentReturnState по заказу с сервера, а не параметр в адресе.
 */

const CORD = "M34 62 L52 80 L88 40";
/** Концы кисточки: веером от обмотки по направлению шнура. */
const FRINGE = [
  [105.3, 27.5],
  [103.8, 25.4],
  [102, 23.6],
  [100.1, 22.1],
  [97.9, 20.8],
] as const;

/** Галочка из шнура макраме: узел в начале, обмотка и кисточка на конце. */
function CordMark({ className }: { className?: string }) {
  const maskId = `cord-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={cn("size-20 text-espresso sm:size-24", className)}
    >
      <circle
        cx="60"
        cy="60"
        r="52"
        stroke="currentColor"
        strokeOpacity="0.14"
        strokeWidth="1.25"
      />
      <mask id={maskId} maskUnits="userSpaceOnUse">
        <path
          d="M34 62 L52 80 L91 36.5"
          pathLength={1}
          className="cord-draw"
          stroke="white"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path
          d={CORD}
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Свив шнура: светлые насечки поперёк */}
        <path
          d={CORD}
          stroke="var(--white)"
          strokeOpacity="0.38"
          strokeWidth="7"
          strokeDasharray="0.8 3"
          strokeLinejoin="round"
        />
        <path d="M86.4 41.8 L91 36.6" stroke="currentColor" strokeWidth="10" />
      </g>
      <circle cx="34" cy="62" r="5.5" fill="currentColor" />
      {FRINGE.map(([x, y], i) => (
        <path
          key={`${x}-${y}`}
          d={`M91 36.5 L${x} ${y}`}
          pathLength={1}
          className="cord-fringe"
          style={{ "--i": i } as CSSProperties}
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

interface Step {
  title: string;
  text?: ReactNode;
  done?: boolean;
}

/** Что будет с заказом дальше: пройденные этапы закрашены, текущий отмечен. */
function Steps({ steps }: { steps: Step[] }) {
  const current = steps.findIndex((step) => !step.done);
  return (
    <ol>
      {steps.map((step, i) => {
        const isCurrent = i === current;
        return (
          <li
            key={step.title}
            className="relative flex gap-4 pb-7 last:pb-0"
            aria-current={isCurrent ? "step" : undefined}
          >
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[9.5px] top-7 bottom-1.5 w-px",
                  step.done ? "bg-espresso" : "bg-espresso/15",
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative mt-px flex size-5 shrink-0 items-center justify-center rounded-full",
                step.done
                  ? "bg-espresso text-parchment"
                  : isCurrent
                    ? "border border-espresso bg-parchment"
                    : "border border-espresso/20 bg-parchment",
              )}
            >
              {step.done ? (
                <CheckIcon className="size-3" />
              ) : (
                isCurrent && (
                  <span className="size-1.5 rounded-full bg-espresso" />
                )
              )}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[15px] leading-snug",
                  step.done || isCurrent ? "text-espresso" : "text-taupe",
                  isCurrent && "font-medium",
                )}
              >
                {step.done && <span className="sr-only">Готово: </span>}
                {step.title}
              </p>
              {step.text && (
                <div className="mt-1 space-y-0.5 text-sm leading-relaxed text-taupe">
                  {step.text}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Lines({ lines }: { lines: (string | null | undefined)[] }) {
  const shown = lines.filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <>
      {shown.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </>
  );
}

function deliveryDatesLabel(dates: OrderView["deliveryDates"]): string | null {
  if (!dates) return null;
  const from = new Date(dates.from);
  const to = new Date(dates.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return formatDateRange(localDateKey(from), localDateKey(to));
}

function pointLabel(order: OrderView): string | null {
  const point = order.deliveryPoint;
  if (!point) return null;
  return pickupPointAddressLine(point.title, point.address) || null;
}

function itemsLabel(order: OrderView): string {
  const [first, ...rest] = order.items;
  if (!first) return `Заказ №${order.number}`;
  return rest.length > 0 ? `${first.name} и ещё ${rest.length}` : first.name;
}

/** Заголовок, вводная и этапы для подтверждённой оплаты. */
function confirmedCopy(order: OrderView): {
  title: string;
  lead: string;
  steps: Step[];
} {
  const no = `№${order.number}`;
  const courier = order.deliveryMethod === "courier";
  const point = pointLabel(order);
  const dates = deliveryDatesLabel(order.deliveryDates);
  const ozonTracking = courier
    ? "Следить за посылкой можно в приложении Ozon."
    : "Следить за посылкой можно в приложении Ozon, там же будет штрихкод для получения.";

  const receive: Step = {
    title: courier ? "Курьер привозит заказ" : "Вы забираете заказ",
    text: (
      <Lines
        lines={[
          dates && `Ожидаемая доставка: ${dates}`,
          point && `Пункт выдачи: ${point}`,
        ]}
      />
    ),
  };

  if (order.kind === "stock") {
    return {
      title: "Спасибо, заказ оплачен",
      lead: `${itemsLabel(order)}, заказ ${no} на ${money(order.amountTotal)}.`,
      steps: [
        {
          title: "Оплата получена",
          text: order.hasEmail
            ? "Подтверждение и чек придут на почту."
            : undefined,
          done: true,
        },
        order.status === "ozon_order_failed"
          ? {
              title: "Ольга оформит доставку сама",
              text: "И напишет вам, когда заказ уйдёт.",
            }
          : {
              title:
                order.status === "fulfilling"
                  ? "Заказ передан в Ozon Доставку"
                  : "Передаём заказ в Ozon Доставку",
              text: ozonTracking,
              done: order.status === "fulfilling",
            },
        receive,
      ],
    };
  }

  // Под заказ после предоплаты: изделие только начинают плести
  if (!order.paid) {
    const deposit = order.depositAmount ?? 0;
    const balance = order.amountTotal - deposit;
    return {
      title: "Спасибо, предоплата получена",
      lead: `${itemsLabel(order)}, заказ ${no}. Внесено ${money(deposit)}, Ольга начинает плести.`,
      steps: [
        {
          title: "Предоплата получена",
          text: order.hasEmail ? "Чек придёт на почту." : undefined,
          done: true,
        },
        {
          title: "Ольга плетёт изделие",
          text: order.leadTime
            ? `Срок изготовления: ${order.leadTime}.`
            : undefined,
        },
        {
          title: "Вы вносите доплату, когда изделие готово",
          text: (
            <Lines
              lines={[
                order.amountDelivery > 0
                  ? `Останется ${money(balance)}, доставка уже в этой сумме.`
                  : `Останется ${money(balance)} и доставка.`,
                order.hasEmail
                  ? "Придёт письмо со ссылкой на оплату."
                  : "Оплатить можно будет на этой странице.",
              ]}
            />
          ),
        },
        {
          title: "Ольга отправляет заказ",
          text: point
            ? `В пункт выдачи: ${point}`
            : order.deliveryPointEditable
              ? "Пункт выдачи можно выбрать в деталях заказа."
              : undefined,
        },
      ],
    };
  }

  return {
    title: "Спасибо, заказ оплачен полностью",
    lead: `${itemsLabel(order)}, заказ ${no} на ${money(order.amountTotal)}.`,
    steps: [
      {
        title: "Доплата получена",
        text: order.hasEmail ? "Чек придёт на почту." : undefined,
        done: true,
      },
      order.status === "ozon_order_failed"
        ? {
            title: "Ольга оформит доставку сама",
            text: "И напишет вам, когда заказ уйдёт.",
          }
        : order.status === "fulfilling"
          ? {
              title: "Заказ передан в Ozon Доставку",
              text: ozonTracking,
              done: true,
            }
          : {
              title: "Ольга упаковывает и отправляет изделие",
              text: "Номер отправления появится на этой странице.",
            },
      {
        ...receive,
        text: (
          <Lines
            lines={[
              point && `Пункт выдачи: ${point}`,
              order.status === "fulfilling" ? null : ozonTracking,
            ]}
          />
        ),
      },
    ],
  };
}

/** Экран возврата: слева что произошло и что дальше, справа карточка заказа. */
export function PaymentReturnLayout({
  children,
  aside,
}: {
  children: ReactNode;
  aside: ReactNode;
}) {
  return (
    <div
      data-analytics-private
      className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-20"
    >
      <div className="min-w-0 lg:pt-4">{children}</div>
      <aside className="lg:sticky lg:top-28">{aside}</aside>
    </div>
  );
}

function Headline({
  mark,
  title,
  lead,
}: {
  mark?: ReactNode;
  title: string;
  lead: ReactNode;
}) {
  return (
    <header>
      {mark}
      <h1
        className={cn(
          "font-serif text-[2.5rem] leading-[1.05] text-espresso text-balance sm:text-5xl lg:text-[3.5rem]",
          mark && "mt-8",
        )}
      >
        {title}
      </h1>
      <div className="mt-5 max-w-xl space-y-2 text-base leading-relaxed text-dark-grey sm:text-lg">
        {lead}
      </div>
    </header>
  );
}

function WriteMaster({
  message,
  primary,
}: {
  message: string;
  primary?: boolean;
}) {
  return (
    <Button
      asChild
      variant={primary ? "default" : "outline"}
      className={cn(
        "h-11 px-5",
        primary && "bg-espresso text-parchment hover:bg-espresso/90",
      )}
    >
      <ContactMasterButton source="order_payment_return" message={message}>
        <MessageCircleIcon aria-hidden="true" />
        Написать Ольге
      </ContactMasterButton>
    </Button>
  );
}

function CatalogLink() {
  return (
    <Link
      href="/catalog"
      className="text-sm text-espresso underline decoration-espresso/30 underline-offset-4 transition-colors hover:decoration-espresso"
    >
      Перейти в каталог
    </Link>
  );
}

export function PaymentConfirmed({ order }: { order: OrderView }) {
  const { title, lead, steps } = confirmedCopy(order);
  return (
    <>
      <Headline mark={<CordMark />} title={title} lead={<p>{lead}</p>} />
      <section className="mt-12 border-t border-espresso/10 pt-8">
        <h2 className="mb-6 font-serif text-2xl text-espresso">Что дальше</h2>
        <Steps steps={steps} />
      </section>
      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
        <WriteMaster
          message={`Здравствуйте, Ольга! Вопрос по заказу №${order.number}.`}
        />
        <CatalogLink />
      </div>
    </>
  );
}

export function PaymentChecking() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-md py-12 text-center"
    >
      <Spinner aria-hidden="true" className="mx-auto size-6 text-espresso" />
      <h1 className="mt-6 font-serif text-3xl text-espresso sm:text-4xl">
        Проверяем оплату
      </h1>
      <p className="mt-3 text-taupe">
        Обычно это занимает несколько секунд. Страница обновится сама.
      </p>
    </div>
  );
}

export function PaymentUnconfirmed({
  order,
  onRetry,
}: {
  order: OrderView;
  onRetry: () => void;
}) {
  return (
    <>
      <Headline
        title="Оплата пока не подтвердилась"
        lead={
          <>
            <p>
              Если вы закрыли страницу оплаты или отменили платёж, деньги не
              списались.{" "}
              {order.kind === "made_to_order"
                ? "Оплатить можно в деталях заказа."
                : "Чтобы купить изделие, оформите заказ заново."}
            </p>
            <p>
              Если деньги списались, подтверждение придёт чуть позже. Проверьте
              ещё раз через минуту или напишите Ольге.
            </p>
          </>
        }
      />
      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
        <Button
          type="button"
          onClick={onRetry}
          className="h-11 bg-espresso px-5 text-parchment hover:bg-espresso/90"
        >
          <RotateCwIcon aria-hidden="true" />
          Проверить ещё раз
        </Button>
        <WriteMaster
          message={`Здравствуйте, Ольга! Я оплатил(а) заказ №${order.number}, но на сайте оплата не отображается.`}
        />
        {order.kind === "stock" && <CatalogLink />}
      </div>
    </>
  );
}

export function PaymentFailed({ order }: { order: OrderView }) {
  return (
    <>
      <Headline
        title="Оплата не прошла"
        lead={
          <p>
            Заказ №{order.number} отменён, деньги не списаны. Если изделие ещё
            нужно, оформите заказ заново.
          </p>
        }
      />
      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
        <Button
          asChild
          className="h-11 bg-espresso px-5 text-parchment hover:bg-espresso/90"
        >
          <Link href="/catalog">Перейти в каталог</Link>
        </Button>
        <WriteMaster
          message={`Здравствуйте, Ольга! Не прошла оплата заказа №${order.number}.`}
        />
      </div>
    </>
  );
}
