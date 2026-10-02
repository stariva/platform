"use client";

import {
  ArrowRightIcon,
  LockKeyholeIcon,
  ShoppingBagIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { PickupPointPicker } from "@/components/checkout/pickup-point-picker";
import { CheckoutProgress } from "@/components/stariva/checkout-progress";
import { OfferAcceptanceNote } from "@/components/stariva/consent-checkbox";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { reachGoal, trackCreatedOrder } from "@/lib/analytics";
import { useCart } from "@/lib/cart/cart-context";
import { useCartValidation } from "@/lib/cart/use-cart-validation";
import {
  formatDateRange,
  localDateKey,
  pointKindLabel,
} from "@/lib/ozon-delivery/format";
import type {
  DeliveryCheckoutResponse,
  DeliverySelection,
  PickupPoint,
} from "@/lib/ozon-delivery/types";
import { formatPrice } from "@/lib/products";
import { CheckoutSection, type SectionStatus } from "./checkout-section";
import { ContactForm, type ContactFormValues } from "./contact-form";
import {
  type DeliveryCost,
  MobileOrderSummary,
  OrderSummary,
} from "./order-summary";

/**
 * Шаги живут на одной странице /checkout, а не на отдельных URL: каждый
 * следующий зависит от данных предыдущего (проверенный телефон, расчёт
 * доставки), так что прямой заход на «/checkout/payment» всё равно пришлось
 * бы разворачивать назад. Пройденные шаги сворачиваются в сводку
 * с «Изменить» — кнопка «Назад» в браузере для навигации не нужна.
 */
type Step = "contact" | "delivery" | "payment";

const checkoutCreateResponseSchema = z.object({
  confirmationUrl: z.url({ protocol: /^https?$/ }),
  analytics: z.object({
    id: z.string().min(1),
    revenue: z.number().nonnegative(),
    products: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        price: z.number().nonnegative(),
        quantity: z.number().int().positive(),
      }),
    ),
  }),
});

const unavailableItemsResponseSchema = z.object({
  unavailableProductSlugs: z.array(z.string()).min(1),
});

type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; quote: DeliveryCheckoutResponse };

export default function CheckoutPage() {
  const { items, hydrated, subtotal, clear, remove } = useCart();
  const { notices, dismissNotices } = useCartValidation();

  const [step, setStep] = useState<Step>("contact");
  const [contact, setContact] = useState<ContactFormValues | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<PickupPoint | null>(null);
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: "idle" });
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (!items.length || checkoutTracked.current) return;
    reachGoal("begin_checkout", {
      items_count: items.reduce((sum, item) => sum + item.quantity, 0),
    });
    checkoutTracked.current = true;
  }, [items]);

  const phone = contact?.phone;
  const pointId = selectedPoint?.id;
  const quoteItemsKey = JSON.stringify(
    items.map((item) => [item.productSlug, item.ozonSku, item.quantity]),
  );

  // Стоимость доставки считаем сразу, как только выбран пункт: без отдельной
  // кнопки «Рассчитать» и заново при смене пункта, телефона или состава
  // biome-ignore lint/correctness/useExhaustiveDependencies: quoteItemsKey отслеживает состав корзины, dropUnavailableItems новый на каждом рендере, quoteAttempt — повтор по кнопке
  useEffect(() => {
    if (!phone || !pointId || items.length === 0) {
      setQuoteState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setQuoteState({ status: "loading" });
    (async () => {
      try {
        const res = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contactPhone: phone,
            items: items.map((i) => ({
              productSlug: i.productSlug,
              quantity: i.quantity,
            })),
            delivery: { method: "pickup", pointId },
          }),
        });
        const data = await res.json();
        if (controller.signal.aborted) return;
        if (res.status === 409 && dropUnavailableItems(data)) return;
        if (!res.ok || !data.available) {
          setQuoteState({
            status: "error",
            message:
              data.error ?? data.reason ?? "Доставка в этот пункт недоступна",
          });
          return;
        }
        setQuoteState({ status: "ready", quote: data });
      } catch {
        if (controller.signal.aborted) return;
        setQuoteState({
          status: "error",
          message: "Не удалось рассчитать доставку",
        });
      }
    })();
    return () => controller.abort();
  }, [phone, pointId, quoteItemsKey, quoteAttempt]);

  /**
   * Корзина живёт в браузере, и товар могут раскупить, пока он в ней лежит.
   * Сервер отвечает списком таких товаров — убираем их, доставка
   * пересчитается сама. Возвращает false, если это другая ошибка.
   */
  function dropUnavailableItems(data: unknown): boolean {
    const parsed = unavailableItemsResponseSchema.safeParse(data);
    if (!parsed.success) return false;
    const slugs = new Set(parsed.data.unavailableProductSlugs);
    const names = items
      .filter((item) => slugs.has(item.productSlug))
      .map((item) => `«${item.name}»`);
    for (const slug of slugs) remove(slug);
    toast.error(
      names.length > 1
        ? `Товаров ${names.join(", ")} уже нет в наличии — мы убрали их из корзины`
        : `Товара ${names[0] ?? ""} уже нет в наличии — мы убрали его из корзины`,
    );
    return true;
  }

  async function handleContactSubmit(data: ContactFormValues) {
    setCheckingPhone(true);
    try {
      const res = await fetch("/api/checkout/delivery-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone }),
      });
      const resData = await res.json();
      if (!res.ok) {
        toast.error(
          resData.error ??
            "Доставка Ozon пока недоступна — напишите нам в Telegram @Olga_Stariva",
        );
        return;
      }
      if (!resData.available) {
        toast.error(resData.reason ?? "Доставка недоступна для этого телефона");
        return;
      }
      const samePhone = contact?.phone === data.phone;
      setContact(data);
      // Вернулись поправить имя или email — сразу обратно к оплате
      setStep(
        samePhone && quoteState.status === "ready" ? "payment" : "delivery",
      );
      reachGoal("checkout_contact_complete");
    } catch {
      toast.error("Не удалось проверить телефон. Попробуйте ещё раз.");
    } finally {
      setCheckingPhone(false);
    }
  }

  function handleDeliveryContinue() {
    if (quoteState.status !== "ready") return;
    setStep("payment");
    reachGoal("checkout_delivery_complete");
  }

  async function handleConfirm() {
    if (quoteState.status !== "ready" || !selectedPoint || !contact) return;
    const delivery: DeliverySelection = {
      method: "pickup",
      pointId: selectedPoint.id,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: contact.name,
          contactPhone: contact.phone,
          contactEmail: contact.email || undefined,
          items: items.map((item) => ({
            productSlug: item.productSlug,
            quantity: item.quantity,
          })),
          delivery,
          personalDataConsent: contact.personalDataConsent === true,
          offerAccepted: true,
        }),
      });
      const data: unknown = await res.json();
      if (res.status === 409 && dropUnavailableItems(data)) {
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const error = z.object({ error: z.string() }).safeParse(data);
        toast.error(
          error.success ? error.data.error : "Не удалось создать заказ",
        );
        setSubmitting(false);
        return;
      }
      const parsed = checkoutCreateResponseSchema.safeParse(data);
      if (!parsed.success) {
        toast.error("Не удалось создать заказ");
        setSubmitting(false);
        return;
      }
      await trackCreatedOrder(parsed.data.analytics);
      setRedirecting(true);
      clear();
      window.location.href = parsed.data.confirmationUrl;
    } catch {
      toast.error("Не удалось создать заказ. Попробуйте позже.");
      setSubmitting(false);
    }
  }

  if (redirecting) {
    return (
      <Shell>
        <div className="py-32 flex flex-col items-center gap-4 text-center">
          <Spinner className="size-6" />
          <p className="text-espresso">Переходим к оплате…</p>
          <p className="text-sm text-taupe">
            Откроется защищённая страница ЮKassa
          </p>
        </div>
      </Shell>
    );
  }

  if (!hydrated) {
    return (
      <Shell>
        <div
          className="grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1fr)_400px]"
          aria-busy="true"
        >
          <div className="space-y-4">
            <Skeleton className="h-96 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
          <Skeleton className="hidden lg:block h-96 rounded-2xl" />
        </div>
      </Shell>
    );
  }

  if (items.length === 0) {
    return (
      <Shell>
        <div className="border-y border-espresso/10 py-20 text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-sand text-espresso">
            <ShoppingBagIcon
              className="size-6"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </div>
          <h1 className="font-serif text-3xl text-espresso mb-3">
            Корзина пуста
          </h1>
          <p className="text-taupe text-sm mb-8">
            Добавьте изделия из каталога, чтобы оформить заказ.
          </p>
          <Button
            asChild
            className="h-12 px-7 rounded-full bg-espresso text-parchment hover:bg-espresso/85"
          >
            <Link href="/catalog">В каталог</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  const quote = quoteState.status === "ready" ? quoteState.quote : null;
  const deliveryCost: DeliveryCost = quote
    ? { status: "ready", kopecks: quote.deliveryPriceKopecks }
    : quoteState.status === "loading"
      ? { status: "loading" }
      : { status: "unknown" };
  const total = subtotal + (quote?.deliveryPriceKopecks ?? 0);
  const deliveryDates = quote ? deliveryWindow(quote) : null;

  const statusOf = (target: Step): SectionStatus => {
    if (target === step) return "active";
    if (target === "contact") return contact ? "done" : "upcoming";
    if (target === "delivery") {
      return contact && selectedPoint ? "done" : "upcoming";
    }
    return "upcoming";
  };

  return (
    <Shell progress={step === "contact" ? 1 : step === "delivery" ? 2 : 3}>
      <h1 className="font-serif text-4xl lg:text-5xl text-espresso mb-6 lg:mb-8">
        Оформление заказа
      </h1>

      <div className="grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div>
          <MobileOrderSummary
            items={items}
            subtotal={subtotal}
            delivery={deliveryCost}
          />

          {notices.length > 0 && (
            <div
              role="alert"
              className="mb-4 flex gap-3 rounded-2xl border border-espresso/15 px-4 py-3 text-sm text-espresso"
            >
              <TriangleAlertIcon
                className="size-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0 space-y-1">
                {notices.map((notice) => (
                  <p key={notice}>{notice}</p>
                ))}
              </div>
              <button
                type="button"
                onClick={dismissNotices}
                className="shrink-0 self-start text-taupe underline underline-offset-4 hover:text-espresso transition-colors"
              >
                Понятно
              </button>
            </div>
          )}

          <div className="space-y-4">
            <CheckoutSection
              index={1}
              title="Контакты"
              status={statusOf("contact")}
              onEdit={() => setStep("contact")}
              editDisabled={submitting}
              summary={
                contact && (
                  <>
                    <p className="text-espresso">{contact.name}</p>
                    <p>
                      {contact.phone}
                      {contact.email && ` · ${contact.email}`}
                    </p>
                  </>
                )
              }
            >
              <ContactForm
                initial={contact}
                busy={checkingPhone}
                submitLabel={contact ? "Сохранить" : "Продолжить"}
                onSubmit={handleContactSubmit}
              />
            </CheckoutSection>

            <CheckoutSection
              index={2}
              title="Пункт выдачи Ozon"
              status={statusOf("delivery")}
              onEdit={() => setStep("delivery")}
              editDisabled={submitting}
              // Карта, адрес и выбранный пункт должны пережить «Изменить»
              keepMounted={contact !== null}
              summary={
                selectedPoint && (
                  <>
                    <p className="text-espresso">
                      {selectedPoint.title}
                      {selectedPoint.locality && `, ${selectedPoint.locality}`}
                    </p>
                    <p>
                      {pointKindLabel(selectedPoint)} Ozon
                      {quote &&
                        ` · ${formatDelivery(quote.deliveryPriceKopecks)}`}
                      {deliveryDates && ` · ${deliveryDates}`}
                    </p>
                  </>
                )
              }
            >
              <div className="space-y-5">
                <PickupPointPicker onChange={setSelectedPoint} />
                {selectedPoint && (
                  <QuoteStatus
                    state={quoteState}
                    window={deliveryDates}
                    onRetry={() => setQuoteAttempt((n) => n + 1)}
                  />
                )}
                <Button
                  onClick={handleDeliveryContinue}
                  disabled={!quote}
                  className="w-full sm:w-auto sm:min-w-56 h-12 rounded-full bg-espresso text-parchment hover:bg-espresso/85"
                >
                  Продолжить к оплате
                  <ArrowRightIcon aria-hidden="true" />
                </Button>
                {!selectedPoint && (
                  <p className="text-xs text-taupe">
                    Выберите пункт на карте или в списке — стоимость доставки
                    посчитаем сразу
                  </p>
                )}
              </div>
            </CheckoutSection>

            <CheckoutSection
              index={3}
              title="Оплата"
              status={statusOf("payment")}
            >
              <div className="space-y-5">
                {/* Состав поменялся уже на этом шаге — доставка пересчитывается */}
                {!quote && (
                  <QuoteStatus
                    state={quoteState}
                    window={null}
                    onRetry={() => setQuoteAttempt((n) => n + 1)}
                  />
                )}
                <dl className="lg:hidden space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-taupe">Товары</dt>
                    <dd className="text-espresso tabular-nums">
                      {formatPrice(subtotal / 100)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-taupe">Доставка</dt>
                    <dd className="text-espresso tabular-nums">
                      {quote ? formatDelivery(quote.deliveryPriceKopecks) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 pt-2 border-t border-espresso/10 text-base">
                    <dt className="text-espresso">Итого</dt>
                    <dd className="text-espresso font-medium tabular-nums">
                      {formatPrice(total / 100)}
                    </dd>
                  </div>
                </dl>
                <p className="flex gap-3 rounded-xl bg-sand px-4 py-3 text-sm text-espresso">
                  <LockKeyholeIcon
                    className="size-4 shrink-0 mt-0.5"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  Оплата на защищённой странице ЮKassa. После оплаты вернём вас
                  на страницу заказа.
                </p>
                <Button
                  onClick={handleConfirm}
                  disabled={submitting || !quote}
                  className="w-full h-14 rounded-full bg-espresso text-parchment hover:bg-espresso/85 text-[15px]"
                >
                  {submitting ? (
                    <Spinner />
                  ) : (
                    `Оплатить ${formatPrice(total / 100)}`
                  )}
                </Button>
                <OfferAcceptanceNote action="Оплатить" />
              </div>
            </CheckoutSection>
          </div>
        </div>

        <OrderSummary
          items={items}
          subtotal={subtotal}
          delivery={deliveryCost}
        />
      </div>
    </Shell>
  );
}

function Shell({
  progress,
  children,
}: {
  progress?: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <>
      <Header variant="solid" />
      <main className="pt-24 lg:pt-32 pb-24 px-5">
        <div className="max-w-6xl mx-auto">
          {progress && <CheckoutProgress current={progress} />}
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}

function QuoteStatus({
  state,
  window,
  onRetry,
}: {
  state: QuoteState;
  window: string | null;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <p
        className="flex items-center gap-2 text-sm text-taupe"
        aria-live="polite"
      >
        <Spinner className="size-3.5" />
        Считаем стоимость доставки…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="flex items-start justify-between gap-4 rounded-xl border border-destructive/30 px-4 py-3 text-sm"
      >
        <p className="text-destructive">{state.message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 text-espresso underline underline-offset-4"
        >
          Повторить
        </button>
      </div>
    );
  }
  if (state.status === "ready") {
    return (
      <p
        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl bg-sand px-4 py-3 text-sm"
        aria-live="polite"
      >
        <span className="text-espresso">
          Доставка — {formatDelivery(state.quote.deliveryPriceKopecks)}
        </span>
        {window && (
          <span className="text-taupe">в пункте ожидаем {window}</span>
        )}
      </p>
    );
  }
  return null;
}

function formatDelivery(kopecks: number): string {
  return kopecks === 0 ? "бесплатно" : formatPrice(kopecks / 100);
}

/**
 * «2 октября – 4 октября» по датам доставки из расчёта Ozon. Если заказ
 * разбит на несколько отправлений, ориентируемся на самое позднее.
 */
function deliveryWindow(quote: DeliveryCheckoutResponse): string | null {
  const latest = (dates: string[]) =>
    dates
      .map((iso) => new Date(iso))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map(localDateKey)
      .sort()
      .at(-1);
  const from = latest(
    quote.splits.map((split) => split.deliveryMethod.logisticDateFrom),
  );
  const to = latest(
    quote.splits.map((split) => split.deliveryMethod.logisticDateTo),
  );
  if (!from || !to) return null;
  return formatDateRange(from, to);
}
