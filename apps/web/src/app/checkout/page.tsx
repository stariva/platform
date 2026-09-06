"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { useCart } from "@/lib/cart/cart-context";
import type {
  DeliveryCheckoutResponse,
  DeliverySelection,
  PickupPoint,
} from "@/lib/ozon-delivery/types";
import { formatPrice } from "@/lib/products";

type Step = "contact" | "delivery" | "review";

const contactFormSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(120),
  phone: z.string().trim().min(5, "Введите телефон").max(20),
  email: z
    .string()
    .trim()
    .email("Некорректный email")
    .optional()
    .or(z.literal("")),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();

  const [step, setStep] = useState<Step>("contact");
  const [contact, setContact] = useState<ContactFormValues | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);

  const contactForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { name: "", phone: "", email: "" },
  });

  const [pickupPoints, setPickupPoints] = useState<PickupPoint[] | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string>("");
  const [loadingPoints, setLoadingPoints] = useState(false);

  const [quote, setQuote] = useState<DeliveryCheckoutResponse | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      void loadPickupPoints();
    } catch {
      toast.error("Не удалось проверить телефон. Попробуйте ещё раз.");
    } finally {
      setCheckingPhone(false);
    }
  }

  async function loadPickupPoints() {
    setLoadingPoints(true);
    try {
      const res = await fetch("/api/checkout/pickup-points");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Не удалось загрузить пункты выдачи");
        return;
      }
      setPickupPoints(data.points);
    } catch {
      toast.error("Не удалось загрузить пункты выдачи");
    } finally {
      setLoadingPoints(false);
    }
  }

  async function handleGetQuote() {
    const delivery: DeliverySelection | null = selectedPointId
      ? { method: "pickup", pointId: selectedPointId }
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
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.available) {
        toast.error(data.error ?? data.reason ?? "Доставка недоступна");
        return;
      }
      setQuote(data);
      setStep("review");
    } catch {
      toast.error("Не удалось рассчитать доставку");
    } finally {
      setQuoting(false);
    }
  }

  async function handleConfirm() {
    if (!quote) return;
    const delivery: DeliverySelection = {
      method: "pickup",
      pointId: selectedPointId,
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
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.confirmationUrl) {
        toast.error(data.error ?? "Не удалось создать заказ");
        setSubmitting(false);
        return;
      }
      clear();
      window.location.href = data.confirmationUrl;
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
                        <Input {...field} />
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
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
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

          {step === "delivery" && (
            <div className="bg-white border border-espresso/10 rounded-2xl p-6 space-y-5">
              <h2 className="font-serif text-xl text-espresso mb-2">
                Способ доставки
              </h2>
              {loadingPoints ? (
                <Spinner className="text-taupe" />
              ) : (
                <select
                  value={selectedPointId}
                  onChange={(e) => setSelectedPointId(e.target.value)}
                  className="w-full rounded-lg border border-espresso/15 px-3 py-2 text-sm text-espresso"
                >
                  <option value="">Выберите пункт выдачи</option>
                  {pickupPoints?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.address}
                    </option>
                  ))}
                </select>
              )}

              <Button
                onClick={handleGetQuote}
                disabled={quoting}
                className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
              >
                {quoting ? <Spinner /> : "Рассчитать доставку"}
              </Button>
            </div>
          )}

          {step === "review" && quote && (
            <div className="bg-white border border-espresso/10 rounded-2xl p-6 space-y-4">
              <h2 className="font-serif text-xl text-espresso mb-2">
                Подтверждение заказа
              </h2>
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
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
