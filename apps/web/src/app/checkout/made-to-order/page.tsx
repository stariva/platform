"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  ConsentCheckbox,
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
import { Textarea } from "@/components/ui/textarea";
import { reachGoal } from "@/lib/analytics";
import { cartLineKey, useCart } from "@/lib/cart/cart-context";
import { rememberOrderPhone } from "@/lib/commerce/order-phone";
import { MADE_TO_ORDER_DAYS } from "@/lib/made-to-order";
import { formatPrice } from "@/lib/products";

const formSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(120),
  phone: z.string().trim().min(5, "Введите телефон").max(32),
  email: z
    .string()
    .trim()
    .email("Некорректный email")
    .optional()
    .or(z.literal("")),
  delivery: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(1500).optional(),
  personalDataConsent: z.boolean().refine((v) => v, PD_CONSENT_ERROR),
});

type FormValues = z.infer<typeof formSchema>;

const createResponseSchema = z.object({
  orderId: z.string().min(1),
  estimate: z.number().nonnegative(),
});

const unavailableItemsResponseSchema = z.object({
  unavailableProductSlugs: z.array(z.string()).min(1),
});

export default function MadeToOrderCheckoutPage() {
  const router = useRouter();
  const { items: cartItems, hydrated, clear, remove } = useCart();
  const items = cartItems.filter(
    (item) => item.fulfillmentType === "made_to_order",
  );
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      delivery: "",
      notes: "",
      personalDataConsent: false,
    },
  });

  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (!items.length || checkoutTracked.current) return;
    reachGoal("begin_checkout", {
      items_count: items.reduce((sum, item) => sum + item.quantity, 0),
      kind: "made_to_order",
    });
    checkoutTracked.current = true;
  }, [items]);

  if (!hydrated) {
    return (
      <>
        <Header variant="solid" />
        <main className="pt-32 pb-24 px-5 max-w-2xl mx-auto text-center">
          <Spinner className="mx-auto" />
        </main>
        <Footer />
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <Header variant="solid" />
        <main className="pt-32 pb-24 px-5 max-w-2xl mx-auto text-center">
          <h1 className="font-serif text-3xl text-espresso mb-4">
            В заказе пока пусто
          </h1>
          <p className="text-taupe mb-8">
            Выберите изделие, размер и цвет — и добавьте его в корзину.
          </p>
          <Button asChild className="bg-terracotta text-parchment">
            <Link href="/catalog">В каталог</Link>
          </Button>
        </main>
        <Footer />
      </>
    );
  }

  /** Изделие могли снять с продажи, пока оно лежало в корзине. */
  function dropUnavailableItems(data: unknown): boolean {
    const parsed = unavailableItemsResponseSchema.safeParse(data);
    if (!parsed.success) return false;
    const slugs = new Set(parsed.data.unavailableProductSlugs);
    const names = items
      .filter((item) => slugs.has(item.productSlug))
      .map((item) => `«${item.name}»`);
    for (const item of items) {
      if (slugs.has(item.productSlug)) remove(cartLineKey(item));
    }
    toast.error(
      names.length > 1
        ? `Изделия ${names.join(", ")} сняты с продажи — мы убрали их из корзины`
        : `Изделие ${names[0] ?? ""} снято с продажи — мы убрали его из корзины`,
    );
    return true;
  }

  async function onSubmit(data: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout/made-to-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: data.name,
          contactPhone: data.phone,
          contactEmail: data.email || undefined,
          deliveryNote: data.delivery || undefined,
          customerNotes: data.notes || undefined,
          items: items.flatMap((item) =>
            item.options
              ? [
                  {
                    productSlug: item.productSlug,
                    quantity: item.quantity,
                    options: {
                      size: item.options.size,
                      color: item.options.color,
                    },
                  },
                ]
              : [],
          ),
          personalDataConsent: data.personalDataConsent === true,
        }),
      });
      const resData: unknown = await res.json();
      if (res.status === 409 && dropUnavailableItems(resData)) {
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const error = z.object({ error: z.string() }).safeParse(resData);
        toast.error(
          error.success ? error.data.error : "Не удалось отправить заявку",
        );
        setSubmitting(false);
        return;
      }
      const parsed = createResponseSchema.safeParse(resData);
      if (!parsed.success) {
        toast.error("Не удалось отправить заявку");
        setSubmitting(false);
        return;
      }
      // Заявка — ещё не покупка: отдельная цель, без ecommerce-«purchase»
      reachGoal("made_to_order_request", {
        order_id: parsed.data.orderId,
        order_price: parsed.data.estimate,
      });
      rememberOrderPhone(parsed.data.orderId, data.phone);
      clear("made_to_order");
      router.push(`/order/${parsed.data.orderId}`);
    } catch {
      toast.error("Не удалось отправить заявку. Попробуйте позже.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header variant="solid" />
      <main className="pt-28 lg:pt-36 pb-24 px-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-serif text-3xl lg:text-4xl text-espresso mb-8">
            Заявка на изделия под заказ
          </h1>

          <ol className="text-taupe text-sm leading-relaxed mb-6 space-y-1.5 list-decimal pl-5">
            <li>
              Сейчас вы ничего не платите — мастер получит заявку и свяжется с
              вами.
            </li>
            <li>
              Вместе уточните мерки, цвет, итоговую цену и доставку. После
              согласования на странице заказа откроется предоплата 50%.
            </li>
            <li>
              Изделие плетётся вручную, обычно за {MADE_TO_ORDER_DAYS}. Когда
              оно готово — доплата остатка и доставки, и мастер отправляет
              заказ.
            </li>
          </ol>

          <div className="bg-white border border-espresso/10 rounded-2xl p-5 mb-8 space-y-3">
            {items.map((item) => (
              <div key={cartLineKey(item)} className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-sand flex-shrink-0">
                  {item.image && (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-espresso text-sm truncate">{item.name}</p>
                  <p className="text-taupe text-xs">
                    {item.options &&
                      `${item.options.size} · ${item.options.color} · `}
                    × {item.quantity}
                  </p>
                </div>
                <span className="text-espresso text-sm">
                  {formatPrice((item.price * item.quantity) / 100)}
                </span>
              </div>
            ))}
            <div className="border-t border-espresso/8 pt-3 flex items-center justify-between font-medium">
              <span className="text-espresso">По каталогу</span>
              <span className="text-espresso">
                {formatPrice(subtotal / 100)}
              </span>
            </div>
            <p className="text-xs text-taupe">
              Итоговую цену и доставку согласует мастер.
            </p>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="bg-white border border-espresso/10 rounded-2xl p-6 space-y-4"
            >
              <h2 className="font-serif text-xl text-espresso mb-2">
                Как с вами связаться
              </h2>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Имя</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="name"
                        disabled={submitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Телефон</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        autoComplete="tel"
                        placeholder="+7 999 123-45-67"
                        disabled={submitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (необязательно)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        disabled={submitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="delivery"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Город и доставка (необязательно)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Например, Казань, пункт СДЭК"
                        disabled={submitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Пожелания к изделию (необязательно)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Оттенок, посадка, сроки, к какому событию нужна вещь…"
                        disabled={submitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
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
                disabled={submitting}
                className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark py-6"
              >
                {submitting ? <Spinner /> : "Отправить заявку мастеру"}
              </Button>
            </form>
          </Form>
        </div>
      </main>
      <Footer />
    </>
  );
}
