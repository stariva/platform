"use client";

import {
  DeliveryPriceChangedError,
  DeliveryUnavailableError,
  type InstantMadeToOrderQuote,
  ItemsUnavailableError,
  ProductsPriceChangedError,
} from "@stariva/web-api/contract";
import {
  ArrowRightIcon,
  LockKeyholeIcon,
  ShoppingBagIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PickupPointPicker } from "@/components/checkout/pickup-point-picker";
import { CheckoutProgress } from "@/components/stariva/checkout-progress";
import { OfferAcceptanceNote } from "@/components/stariva/consent-checkbox";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { reachGoal, trackCreatedOrder } from "@/lib/analytics";
import { cartLineKey, useCart } from "@/lib/cart/cart-context";
import { useCartValidation } from "@/lib/cart/use-cart-validation";
import { rememberOrderPhone } from "@/lib/commerce/order-phone";
import {
  pickupPointAddressLine,
  pointKindLabel,
} from "@/lib/ozon-delivery/format";
import type { PickupPoint } from "@/lib/ozon-delivery/types";
import { formatPrice } from "@/lib/products";
import { formErrorMessage, webApi } from "@/lib/web-api";
import { CheckoutSection, type SectionStatus } from "../../checkout-section";
import { ContactForm, type ContactFormValues } from "../../contact-form";
import {
  type DeliveryCost,
  MobileOrderSummary,
  OrderSummary,
} from "../../order-summary";

type Step = "contact" | "delivery" | "payment";

type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; quote: InstantMadeToOrderQuote };

/**
 * Мгновенная оплата изделий, которые печатаются после заказа. В отличие от
 * обычной заявки под заказ, образец уже фиксирован, поэтому покупатель сразу
 * выбирает пункт Ozon и оплачивает изделия вместе с доставкой.
 */
export default function InstantMadeToOrderCheckoutPage() {
  const {
    items: cartItems,
    hydrated,
    clearInstantMadeToOrder,
    remove,
  } = useCart();
  const items = useMemo(
    () =>
      cartItems.filter(
        (item) =>
          item.fulfillmentType === "made_to_order" &&
          item.instantMadeToOrder === true,
      ),
    [cartItems],
  );
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const { notices, dismissNotices, refresh } = useCartValidation();

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
    items.map((item) => [item.productSlug, item.quantity]),
  );

  // Стоимость доставки считаем сразу после выбора пункта. Ozon Delivery for
  // Business оценивает заранее заданную посылку набора, карточки Seller не нужны.
  // biome-ignore lint/correctness/useExhaustiveDependencies: quoteItemsKey отслеживает состав корзины, quoteAttempt — повтор по кнопке
  useEffect(() => {
    if (!phone || !pointId || items.length === 0) {
      setQuoteState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setQuoteState({ status: "loading" });
    (async () => {
      try {
        const data = await webApi.checkout.quoteInstantMadeToOrder(
          {
            contactPhone: phone,
            items: items.map((item) => ({
              productId: item.productId,
              productSlug: item.productSlug,
              quantity: item.quantity,
            })),
            delivery: { method: "pickup", pointId },
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (!data.available) {
          setQuoteState({
            status: "error",
            message: data.reason ?? "Доставка в этот пункт недоступна",
          });
          return;
        }
        setQuoteState({ status: "ready", quote: data });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ItemsUnavailableError) {
          dropUnavailableItems(error.data.unavailableProductSlugs);
          return;
        }
        setQuoteState({
          status: "error",
          message: formErrorMessage(error, "Не удалось рассчитать доставку"),
        });
      }
    })();
    return () => controller.abort();
  }, [phone, pointId, quoteItemsKey, quoteAttempt]);

  /** Сервер видит актуальный каталог: снятые с продажи изделия убираем из корзины. */
  function dropUnavailableItems(unavailableProductSlugs: string[]) {
    const slugs = new Set(unavailableProductSlugs);
    const unavailable = items.filter((item) => slugs.has(item.productSlug));
    for (const item of unavailable) remove(cartLineKey(item));
    const names = unavailable.map((item) => `«${item.name}»`);
    toast.error(
      names.length > 1
        ? `Изделия ${names.join(", ")} сейчас нельзя заказать — мы убрали их из корзины`
        : `Изделие ${names[0] ?? ""} сейчас нельзя заказать — мы убрали его из корзины`,
    );
  }

  async function handleContactSubmit(data: ContactFormValues) {
    setCheckingPhone(true);
    try {
      const resData = await webApi.checkout.checkInstantMadeToOrderPhone({
        phone: data.phone,
      });
      if (!resData.available) {
        toast.error(resData.reason ?? "Доставка недоступна для этого телефона");
        return;
      }
      const samePhone = contact?.phone === data.phone;
      setContact(data);
      setStep(
        samePhone && quoteState.status === "ready" ? "payment" : "delivery",
      );
      reachGoal("checkout_contact_complete");
    } catch (error) {
      toast.error(
        error instanceof DeliveryUnavailableError
          ? "Доставка Ozon пока недоступна — напишите нам в Telegram @Olga_Stariva"
          : formErrorMessage(
              error,
              "Не удалось проверить телефон. Попробуйте ещё раз.",
            ),
      );
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
    if (
      !items.length ||
      quoteState.status !== "ready" ||
      !selectedPoint ||
      !contact
    ) {
      return;
    }
    if (contact.personalDataConsent !== true) return;

    setSubmitting(true);
    try {
      const created = await webApi.checkout.createInstantMadeToOrder({
        contactName: contact.name,
        contactPhone: contact.phone,
        contactEmail: contact.email,
        comment: contact.comment || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          productSlug: item.productSlug,
          quantity: item.quantity,
        })),
        delivery: {
          method: "pickup",
          pointId: selectedPoint.id,
          // Адрес понадобится мастеру, если справочник пунктов временно недоступен
          pointLabel: pickupPointAddressLine(
            selectedPoint.title,
            selectedPoint.address,
          ),
        },
        expectedDeliveryKopecks: quoteState.quote.deliveryPriceKopecks,
        expectedProductsKopecks: subtotal,
        personalDataConsent: contact.personalDataConsent,
        offerAccepted: true,
      });
      await trackCreatedOrder(created.analytics);
      rememberOrderPhone(created.orderId, contact.phone);
      setRedirecting(true);
      clearInstantMadeToOrder(created.orderId);
      window.location.href = created.confirmationUrl;
    } catch (error) {
      if (error instanceof ItemsUnavailableError) {
        dropUnavailableItems(error.data.unavailableProductSlugs);
      } else if (error instanceof DeliveryPriceChangedError) {
        setQuoteAttempt((n) => n + 1);
        toast.error(error.message);
      } else if (error instanceof ProductsPriceChangedError) {
        refresh();
        toast.error(error.message);
      } else {
        toast.error(
          formErrorMessage(
            error,
            "Не удалось создать заказ. Попробуйте позже.",
          ),
        );
      }
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
            Новогодняя коробка пуста
          </h1>
          <p className="text-taupe text-sm mb-8">
            Соберите свой набор или выберите готовый на странице коллекции.
          </p>
          <Button
            asChild
            className="h-12 px-7 rounded-full bg-espresso text-parchment hover:bg-espresso/85"
          >
            <Link href="/novogodnie-ukrasheniya">К новогодней коллекции</Link>
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
      <h1 className="font-serif text-4xl lg:text-5xl text-espresso mb-3">
        Оформление новогоднего набора
      </h1>
      <p className="mb-6 lg:mb-8 max-w-2xl text-sm leading-relaxed text-taupe">
        Изделия напечатают после оплаты. Точную стоимость доставки покажем до
        оплаты, отдельной доплаты после изготовления не будет.
      </p>

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
                      {` · ${contact.email}`}
                    </p>
                    {contact.comment && (
                      <p className="whitespace-pre-line">
                        Комментарий: {contact.comment}
                      </p>
                    )}
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
                {!quote && (
                  <QuoteStatus
                    state={quoteState}
                    onRetry={() => setQuoteAttempt((n) => n + 1)}
                  />
                )}
                <dl className="lg:hidden space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-taupe">Изделия</dt>
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
                  Оплата на защищённой странице ЮKassa. После оплаты изделия
                  уйдут в производство, а когда будут готовы, мы отправим их в
                  выбранный пункт Ozon.
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
  onRetry,
}: {
  state: QuoteState;
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
        <span className="text-taupe">после изготовления набора</span>
      </p>
    );
  }
  return null;
}

function formatDelivery(kopecks: number): string {
  return kopecks === 0 ? "бесплатно" : formatPrice(kopecks / 100);
}
