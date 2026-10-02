"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PickupPointPicker } from "@/components/checkout/pickup-point-picker";
import {
  ConsentCheckbox,
  OfferAcceptanceNote,
  PD_CONSENT_ERROR,
  PersonalDataConsentLabel,
} from "@/components/stariva/consent-checkbox";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { reachGoal, trackCreatedOrder } from "@/lib/analytics";
import { cartLineKey, useCart } from "@/lib/cart/cart-context";
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

type Step = "contact" | "delivery" | "review";

const contactFormSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(120),
  phone: z.string().trim().min(5, "Введите телефон").max(32),
  email: z
    .string()
    .trim()
    .email("Некорректный email")
    .optional()
    .or(z.literal("")),
  personalDataConsent: z.boolean().refine((v) => v, PD_CONSENT_ERROR),
});

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

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function CheckoutPage() {
  const { items: cartItems, clear, remove } = useCart();
  // Изделия под заказ оплачиваются отдельно — на /checkout/made-to-order
  const items = cartItems.filter((item) => item.fulfillmentType === "stock");
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const [step, setStep] = useState<Step>("contact");
  const [contact, setContact] = useState<ContactFormValues | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);

  const contactForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      personalDataConsent: false,
    },
  });

  const [selectedPoint, setSelectedPoint] = useState<PickupPoint | null>(null);

  const [quote, setQuote] = useState<DeliveryCheckoutResponse | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (!items.length || checkoutTracked.current) return;
    reachGoal("begin_checkout", {
      items_count: items.reduce((sum, item) => sum + item.quantity, 0),
    });
    checkoutTracked.current = true;
  }, [items]);

  if (items.length === 0) {
    return (
      <>
        <Header variant="solid" />
        <main className="pt-32 pb-24 px-5 max-w-2xl mx-auto text-center">
          <h1 className="font-serif text-3xl text-espresso mb-4">
            Корзина пуста
          </h1>
          <p className="text-taupe mb-8">
            Добавьте товары из каталога, чтобы оформить заказ.
          </p>
          <Button asChild className="bg-terracotta text-parchment">
            <Link href="/catalog">В каталог</Link>
          </Button>
        </main>
        <Footer />
      </>
    );
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
      setContact(data);
      setStep("delivery");
      reachGoal("checkout_contact_complete");
    } catch {
      toast.error("Не удалось проверить телефон. Попробуйте ещё раз.");
    } finally {
      setCheckingPhone(false);
    }
  }

  /**
   * Корзина живёт в браузере, и товар могут раскупить, пока он в ней лежит.
   * Сервер отвечает списком таких товаров — убираем их и просим пересчитать
   * доставку уже без них. Возвращает false, если это другая ошибка.
   */
  function dropUnavailableItems(data: unknown): boolean {
    const parsed = unavailableItemsResponseSchema.safeParse(data);
    if (!parsed.success) return false;
    const slugs = new Set(parsed.data.unavailableProductSlugs);
    const names = items
      .filter((item) => slugs.has(item.productSlug))
      .map((item) => `«${item.name}»`);
    for (const slug of slugs) {
      remove(cartLineKey({ productSlug: slug, fulfillmentType: "stock" }));
    }
    setQuote(null);
    setStep("delivery");
    toast.error(
      names.length > 1
        ? `Товаров ${names.join(", ")} уже нет в наличии — мы убрали их из корзины`
        : `Товара ${names[0] ?? ""} уже нет в наличии — мы убрали его из корзины`,
    );
    return true;
  }

  async function handleGetQuote() {
    const delivery: DeliverySelection | null = selectedPoint
      ? { method: "pickup", pointId: selectedPoint.id }
      : null;

    if (!delivery) {
      toast.error("Выберите пункт выдачи");
      return;
    }

    setQuoting(true);
    try {
      const res = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactPhone: contact?.phone,
          items: items.map((i) => ({
            productSlug: i.productSlug,
            quantity: i.quantity,
          })),
          delivery,
          personalDataConsent: contact?.personalDataConsent === true,
          offerAccepted: true,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && dropUnavailableItems(data)) return;
      if (!res.ok || !data.available) {
        toast.error(data.error ?? data.reason ?? "Доставка недоступна");
        return;
      }
      setQuote(data);
      setStep("review");
      reachGoal("checkout_delivery_complete");
    } catch {
      toast.error("Не удалось рассчитать доставку");
    } finally {
      setQuoting(false);
    }
  }

  async function handleConfirm() {
    if (!quote || !selectedPoint) return;
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
          contactName: contact?.name,
          contactPhone: contact?.phone,
          contactEmail: contact?.email || undefined,
          items: items.map((item) => ({
            productSlug: item.productSlug,
            quantity: item.quantity,
          })),
          delivery,
          personalDataConsent: contact?.personalDataConsent === true,
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
      clear("stock");
      window.location.href = parsed.data.confirmationUrl;
    } catch {
      toast.error("Не удалось создать заказ. Попробуйте позже.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header variant="solid" />
      <main className="pt-28 lg:pt-36 pb-24 px-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-serif text-3xl lg:text-4xl text-espresso mb-8">
            Оформление заказа
          </h1>

          {/* Order summary */}
          <p className="text-taupe text-sm leading-relaxed mb-6">
            Заказ оформляется на Stariva, оплата — через ЮKassa. Получение — в
            доступном пункте выдачи Ozon. Стоимость доставки рассчитаем после
            выбора пункта и покажем до оплаты.
          </p>
          <div className="bg-white border border-espresso/10 rounded-2xl p-5 mb-8 space-y-3">
            {items.map((item) => (
              <div key={item.productSlug} className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-sand flex-shrink-0">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-espresso text-sm truncate">{item.name}</p>
                  <p className="text-taupe text-xs">× {item.quantity}</p>
                </div>
                <span className="text-espresso text-sm">
                  {formatPrice((item.price * item.quantity) / 100)}
                </span>
              </div>
            ))}
            <div className="border-t border-espresso/8 pt-3 flex items-center justify-between font-medium">
              <span className="text-espresso">Товары</span>
              <span className="text-espresso">
                {formatPrice(subtotal / 100)}
              </span>
            </div>
          </div>

          {step === "contact" && (
            <Form {...contactForm}>
              <form
                onSubmit={contactForm.handleSubmit(handleContactSubmit)}
                className="bg-white border border-espresso/10 rounded-2xl p-6 space-y-4"
              >
                <h2 className="font-serif text-xl text-espresso mb-2">
                  Контактные данные
                </h2>
                <FormField
                  control={contactForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Имя</FormLabel>
                      <FormControl>
                        <Input disabled={checkingPhone} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Телефон</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+7 999 123-45-67"
                          disabled={checkingPhone}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (необязательно)</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          disabled={checkingPhone}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="personalDataConsent"
                  render={({ field, fieldState }) => (
                    <ConsentCheckbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      error={fieldState.error?.message}
                    >
                      <PersonalDataConsentLabel />
                    </ConsentCheckbox>
                  )}
                />
                <Button
                  type="submit"
                  disabled={checkingPhone}
                  className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
                >
                  {checkingPhone ? <Spinner /> : "Далее"}
                </Button>
              </form>
            </Form>
          )}

          {step !== "contact" && (
            // Шаг остаётся смонтированным и на подтверждении, чтобы по
            // «Изменить» вернуться к той же карте, адресу и выбранному пункту
            <div
              hidden={step !== "delivery"}
              className="bg-white border border-espresso/10 rounded-2xl p-6 space-y-5"
            >
              <h2 className="font-serif text-xl text-espresso">
                Пункт выдачи Ozon
              </h2>
              <PickupPointPicker onChange={setSelectedPoint} />
              <div className="space-y-2">
                <Button
                  onClick={handleGetQuote}
                  disabled={quoting || !selectedPoint}
                  className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
                >
                  {quoting ? <Spinner /> : "Рассчитать доставку"}
                </Button>
                {!selectedPoint && (
                  <p className="text-center text-xs text-taupe">
                    Выберите пункт на карте или в списке
                  </p>
                )}
              </div>
            </div>
          )}

          {step === "review" && quote && selectedPoint && (
            <div className="bg-white border border-espresso/10 rounded-2xl p-6 space-y-4">
              <h2 className="font-serif text-xl text-espresso mb-2">
                Подтверждение заказа
              </h2>
              <div className="flex items-start justify-between gap-4 rounded-xl bg-sand px-4 py-3">
                <div className="min-w-0 text-sm">
                  <p className="text-xs text-taupe">
                    {pointKindLabel(selectedPoint)} Ozon
                  </p>
                  <p className="font-medium text-espresso">
                    {selectedPoint.title}
                  </p>
                  {selectedPoint.locality && (
                    <p className="text-taupe">{selectedPoint.locality}</p>
                  )}
                  {deliveryWindow(quote) && (
                    <p className="mt-1 text-espresso">
                      Ожидаемая доставка в пункт: {deliveryWindow(quote)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuote(null);
                    setStep("delivery");
                  }}
                  disabled={submitting}
                  className="shrink-0 text-sm text-espresso underline"
                >
                  Изменить
                </button>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-taupe">Доставка</span>
                <span className="text-espresso">
                  {formatPrice(quote.deliveryPriceKopecks / 100)}
                </span>
              </div>
              <div className="flex items-center justify-between font-medium border-t border-espresso/8 pt-3">
                <span className="text-espresso">Итого</span>
                <span className="text-espresso">
                  {formatPrice((subtotal + quote.deliveryPriceKopecks) / 100)}
                </span>
              </div>
              <Button
                onClick={handleConfirm}
                disabled={submitting}
                className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark py-6"
              >
                {submitting ? <Spinner /> : "Оплатить"}
              </Button>
              <OfferAcceptanceNote action="Оплатить" />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
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
