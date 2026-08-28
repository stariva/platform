"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Footer } from "@/components/stariva/footer";
import { Header } from "@/components/stariva/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useCart } from "@/lib/cart/cart-context";
import type {
  DeliveryCheckoutResponse,
  DeliverySelection,
  PickupPoint,
} from "@/lib/ozon-delivery/types";
import { formatPrice } from "@/lib/products";

type Step = "contact" | "delivery" | "review";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();

  const [step, setStep] = useState<Step>("contact");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [checkingPhone, setCheckingPhone] = useState(false);

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

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Заполните имя и телефон");
      return;
    }

    setCheckingPhone(true);
    try {
      const res = await fetch("/api/checkout/delivery-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(
          data.error ??
            "Доставка Ozon пока недоступна — напишите нам в Telegram @Olga_Stariva",
        );
        return;
      }
      if (!data.available) {
        toast.error(data.reason ?? "Доставка недоступна для этого телефона");
        return;
      }
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
          contactPhone: phone,
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
          contactName: name,
          contactPhone: phone,
          contactEmail: email || undefined,
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
            <form
              onSubmit={handleContactSubmit}
              className="bg-white border border-espresso/10 rounded-2xl p-6 space-y-4"
            >
              <h2 className="font-serif text-xl text-espresso mb-2">
                Контактные данные
              </h2>
              <div className="space-y-1.5">
                <Label htmlFor="name">Имя</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 999 123-45-67"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email (необязательно)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                disabled={checkingPhone}
                className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark"
              >
                {checkingPhone ? <Spinner /> : "Далее"}
              </Button>
            </form>
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
