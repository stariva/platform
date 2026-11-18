"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ItemsUnavailableError,
  type MadeToOrderContactChannel,
  madeToOrderContactChannelSchema,
  normalizeTelegramHandle,
  TELEGRAM_HANDLE_ERROR,
} from "@stariva/web-api/contract";
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
import {
  MailIcon,
  MaxIcon,
  TelegramIcon,
  WhatsappIcon,
} from "@/components/stariva/icons";
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
import { useCartValidation } from "@/lib/cart/use-cart-validation";
import { rememberOrderPhone } from "@/lib/commerce/order-phone";
import { madeToOrderLeadTimeOf } from "@/lib/made-to-order";
import { formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";
import { formErrorMessage, webApi } from "@/lib/web-api";

const CONTACT_CHANNELS = [
  { id: "telegram", label: "Telegram", Icon: TelegramIcon },
  { id: "whatsapp", label: "WhatsApp", Icon: WhatsappIcon },
  { id: "max", label: "MAX", Icon: MaxIcon },
  { id: "email", label: "Email", Icon: MailIcon },
] as const satisfies readonly {
  id: MadeToOrderContactChannel;
  label: string;
  Icon: typeof TelegramIcon;
}[];

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Введите имя").max(120),
    phone: z.string().trim().min(5, "Введите телефон").max(32),
    email: z
      .string()
      .trim()
      .min(1, "Введите email")
      .email("Некорректный email"),
    preferredContactChannel: madeToOrderContactChannelSchema,
    contactMessenger: z.string().trim().optional(),
    notes: z.string().trim().max(1500).optional(),
    personalDataConsent: z.boolean().refine((v) => v, PD_CONSENT_ERROR),
  })
  .superRefine((data, ctx) => {
    if (data.preferredContactChannel !== "telegram") return;
    if (
      (data.contactMessenger?.length ?? 0) <= 120 &&
      normalizeTelegramHandle(data.contactMessenger ?? "")
    )
      return;
    ctx.addIssue({
      code: "custom",
      path: ["contactMessenger"],
      message: TELEGRAM_HANDLE_ERROR,
    });
  });

type FormValues = z.infer<typeof formSchema>;

export default function MadeToOrderCheckoutPage() {
  const router = useRouter();
  const { items: cartItems, hydrated, clear, remove } = useCart();
  const items = cartItems.filter(
    (item) => item.fulfillmentType === "made_to_order",
  );
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const [submitting, setSubmitting] = useState(false);
  // Срок — из изделий в заказе: у кого в каталоге свой срок, берём его, иначе общий
  const { leadTimes } = useCartValidation();
  const leadTime = madeToOrderLeadTimeOf(
    items.map((item) => ({ leadTimeDays: leadTimes.get(cartLineKey(item)) })),
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      contactMessenger: "",
      notes: "",
      personalDataConsent: false,
    },
  });
  const contactChannel = form.watch("preferredContactChannel");

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
  function dropUnavailableItems(unavailableProductSlugs: string[]) {
    const slugs = new Set(unavailableProductSlugs);
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
  }

  async function onSubmit(data: FormValues) {
    // Форма уже не пропускает без согласия; здесь сужаем тип до того, что просит API
    if (data.personalDataConsent !== true) return;
    setSubmitting(true);
    try {
      const requested = await webApi.checkout.requestMadeToOrder({
        contactName: data.name,
        contactPhone: data.phone,
        contactEmail: data.email,
        preferredContactChannel: data.preferredContactChannel,
        contactMessenger:
          data.preferredContactChannel === "telegram"
            ? (normalizeTelegramHandle(data.contactMessenger ?? "") ??
              undefined)
            : undefined,
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
        personalDataConsent: data.personalDataConsent,
      });
      // Заявка — ещё не покупка: отдельная цель, без ecommerce-«purchase»
      reachGoal("made_to_order_request", {
        order_id: requested.orderId,
        order_price: requested.estimate,
        contact_channel: data.preferredContactChannel,
      });
      rememberOrderPhone(requested.orderId, data.phone);
      clear("made_to_order", requested.orderId);
      router.push(`/order/${requested.orderId}`);
    } catch (error) {
      if (error instanceof ItemsUnavailableError) {
        dropUnavailableItems(error.data.unavailableProductSlugs);
      } else {
        toast.error(
          formErrorMessage(
            error,
            "Не удалось отправить заявку. Попробуйте позже.",
          ),
        );
      }
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
              Вместе уточните мерки, цвет и итоговую цену. После согласования на
              странице заказа откроется предоплата 50%.
            </li>
            <li>
              Изделие плетётся вручную, обычно за {leadTime}. Когда оно готово,
              вы выбираете на странице заказа пункт выдачи Ozon, и сайт сразу
              считает доставку. Вы вносите доплату — остаток и доставку, и
              мастер отправляет заказ.
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
              Итоговую цену согласует мастер, доставку посчитает Ozon.
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
                    <p className="text-xs text-taupe">
                      Лучше тот, что в приложении Ozon: там будет штрихкод для
                      получения заказа.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        disabled={submitting}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-taupe">
                      Пришлём статус заказа и чек.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preferredContactChannel"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <fieldset
                      disabled={submitting}
                      aria-invalid={!!fieldState.error}
                      aria-describedby={
                        fieldState.error ? "contact-channel-error" : undefined
                      }
                      className="space-y-2"
                    >
                      <legend className="text-sm font-medium leading-none">
                        Где удобнее ответить? (обязательно)
                      </legend>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {CONTACT_CHANNELS.map(({ id, label, Icon }) => {
                          const selected = field.value === id;
                          return (
                            <label
                              key={id}
                              className={cn(
                                "flex cursor-pointer flex-col items-center gap-2 rounded-xl border px-3 py-3 text-center transition-colors focus-within:ring-2 focus-within:ring-terracotta/40",
                                selected
                                  ? "border-terracotta bg-terracotta/5 text-espresso"
                                  : "border-espresso/15 bg-white text-espresso hover:border-espresso/30",
                                submitting && "cursor-not-allowed opacity-60",
                              )}
                            >
                              <input
                                type="radio"
                                name={field.name}
                                required
                                value={id}
                                checked={selected}
                                onChange={() => field.onChange(id)}
                                onBlur={field.onBlur}
                                className="sr-only"
                              />
                              <span
                                className={cn(
                                  "flex size-9 items-center justify-center rounded-full transition-colors",
                                  selected
                                    ? "bg-terracotta text-parchment"
                                    : "bg-sand text-espresso",
                                )}
                              >
                                <Icon className="size-5" />
                              </span>
                              <span className="text-sm font-medium">
                                {label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                    <p className="text-xs text-taupe">
                      {contactChannel === "telegram" &&
                        "Напишем в Telegram — укажите ник ниже."}
                      {contactChannel === "whatsapp" &&
                        "Напишем на номер из заявки — проверьте, что он привязан к WhatsApp."}
                      {contactChannel === "max" &&
                        "Напишем на номер из заявки в MAX."}
                      {contactChannel === "email" &&
                        "Напишем на email из заявки — проверьте адрес."}
                    </p>
                    <FormMessage id="contact-channel-error" />
                  </FormItem>
                )}
              />
              {contactChannel === "telegram" && (
                <FormField
                  control={form.control}
                  name="contactMessenger"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ник в Telegram</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          placeholder="@anna_star"
                          disabled={submitting}
                          {...field}
                          onBlur={() => {
                            const normalized = normalizeTelegramHandle(
                              field.value ?? "",
                            );
                            if (normalized) field.onChange(normalized);
                            field.onBlur();
                          }}
                        />
                      </FormControl>
                      <p className="text-xs text-taupe">
                        Например, @anna_star. Посмотреть ник: Telegram →
                        Настройки → Имя пользователя. Если ника нет, выберите
                        WhatsApp — напишем на телефон.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
