"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CustomOrderConflictError } from "@stariva/web-api/contract";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  ConsentCheckbox,
  PD_CONSENT_ERROR,
  PersonalDataConsentLabel,
} from "@/components/stariva/consent-checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reachGoal, trackProductEvent } from "@/lib/analytics";
import { useCart } from "@/lib/cart/cart-context";
import type { Product } from "@/lib/catalog/types";
import { hasReadySample, IN_STOCK_SHIP_DAYS } from "@/lib/in-stock";
import {
  CUSTOM_SIZE,
  type MadeToOrderConfig,
  madeToOrderLeadTime,
  madeToOrderSizes,
  PHOTO_COLOR,
  PHOTO_SIZE,
} from "@/lib/made-to-order";
import { formatPrice } from "@/lib/products";
import { formErrorMessage, isServerError, webApi } from "@/lib/web-api";

interface MadeToOrderProps {
  product: Product;
  config: MadeToOrderConfig;
  productUrl: string;
}

/** Показывает срок изготовления, выбор размера и цвета и открывает заявку. */
export function MadeToOrder({ product, config, productUrl }: MadeToOrderProps) {
  const sizes = madeToOrderSizes(product, config);
  const isClothes = product.category === "clothes";
  // Одежду готовой не продаём, но готовый образец сокращает срок заказа
  const readySample = hasReadySample(product);
  const router = useRouter();
  const { add } = useCart();

  const [size, setSize] = useState<string>(
    isClothes ? CUSTOM_SIZE : (sizes[0] ?? PHOTO_SIZE),
  );
  const [open, setOpen] = useState(false);
  // Оттенок шнура не выбираем в карточке — согласуем с мастером перед плетением
  const color = PHOTO_COLOR;

  // Есть цена в каталоге — изделие можно положить в корзину и оформить заявку
  const canOrder = product.currency === "RUB" && product.price > 0;

  function addToCart() {
    add({
      productSlug: product.slug,
      fulfillmentType: "made_to_order",
      name: product.name,
      image: product.images[0] ?? "",
      price: Math.round(product.price * 100),
      options: {
        size,
        color,
        measurements: [],
      },
    });
    trackProductEvent("add", [
      {
        id: product.slug,
        name: product.name,
        price: product.price,
        quantity: 1,
        category: product.category,
      },
    ]);
    reachGoal("made_to_order_add_to_cart", { category: product.category });
    router.push("/cart");
  }

  return (
    <div className="mb-8 rounded-xl border border-espresso/8 bg-sand p-5">
      <div className="flex items-center gap-2 label-caps text-[11px] text-terracotta mb-2">
        <ScissorsIcon />
        Под заказ · {madeToOrderLeadTime(product)}
      </div>
      <h2 className="font-serif text-xl text-espresso mb-1.5">
        {config.title}
      </h2>
      <p className="text-taupe text-[13px] leading-relaxed mb-5">
        {config.lead}
      </p>
      {readySample && (
        <p className="flex gap-2 mb-5 rounded-lg border border-sage/30 bg-sage/5 px-4 py-3 text-espresso text-[13px] leading-relaxed">
          <span className="size-1.5 mt-2 shrink-0 rounded-full bg-sage" />
          <span>
            Есть готовый образец
            {product.sizes?.length === 1 ? ` размера ${product.sizes[0]}` : ""}.
            Если он подойдёт по вашим меркам, отправим за {IN_STOCK_SHIP_DAYS} —
            мастер подтвердит при согласовании заказа.
          </span>
        </p>
      )}

      {/* Размер: для одежды — стандартные или по меркам, для остальных — только если заданы в каталоге */}
      {(isClothes || sizes.length > 0) && (
        <fieldset className="mb-4">
          <legend className="label-caps text-[11px] text-taupe mb-2">
            Размер
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {sizes.map((s) => (
              <Chip key={s} active={size === s} onClick={() => setSize(s)}>
                {s}
              </Chip>
            ))}
            {isClothes && (
              <Chip
                active={size === CUSTOM_SIZE}
                onClick={() => setSize(CUSTOM_SIZE)}
                accent
              >
                По вашим меркам
              </Chip>
            )}
          </div>
          {product.dimensions && (
            <p className="text-taupe text-[11px] mt-2">
              На фото: {product.dimensions}
            </p>
          )}
        </fieldset>
      )}
      {!isClothes && sizes.length === 0 && product.dimensions && (
        <p className="text-taupe text-[11px] mb-4">
          Размер: {product.dimensions}
        </p>
      )}

      <p className="text-taupe text-[11px] mb-5">
        {product.color ? `Цвет шнура на фото: ${product.color}. ` : ""}
        Другой оттенок — тоже можно, согласуем перед плетением.
      </p>

      {isClothes && (
        <details className="group mb-5 rounded-lg border border-espresso/10 bg-parchment/60">
          <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-3 text-[13px] text-espresso">
            Как снять мерки
            <ChevronIcon />
          </summary>
          <ul className="px-4 pb-4 space-y-2">
            {config.measurements.map((m) => (
              <li key={m.id} className="text-[12px] leading-snug">
                <span className="text-espresso">{m.label}</span>
                <span className="text-taupe"> — {m.hint}</span>
              </li>
            ))}
            <li className="text-[12px] leading-snug text-taupe pt-1">
              Мерьте сантиметровой лентой поверх белья, не затягивая. Если
              сомневаетесь — пришлите фото любимой вещи, подходящей по размеру.
            </li>
          </ul>
        </details>
      )}

      {canOrder && (
        <div className="mb-3">
          <Button
            type="button"
            onClick={addToCart}
            className="w-full bg-terracotta hover:bg-espresso text-white py-3.5 h-auto rounded-2xl transition-colors label-caps"
          >
            Заказать · {formatPrice(product.price)}
          </Button>
          <p className="text-taupe text-[11px] leading-relaxed mt-2">
            Сейчас без оплаты: мастер свяжется с вами, уточнит мерки, цвет,
            итоговую цену и доставку. Предоплата 50% — после согласования,
            остаток — когда изделие готово.
          </p>
        </div>
      )}

      <Button
        type="button"
        variant={canOrder ? "outline" : "default"}
        onClick={() => {
          setOpen(true);
          reachGoal("made_to_order_open", { category: product.category });
        }}
        className={
          canOrder
            ? "w-full py-3.5 h-auto rounded-2xl transition-colors label-caps"
            : "w-full bg-terracotta hover:bg-espresso text-white py-3.5 h-auto rounded-2xl transition-colors label-caps"
        }
      >
        {canOrder ? "Задать вопрос мастеру" : config.cta}
      </Button>

      <MadeToOrderDialog
        open={open}
        onOpenChange={setOpen}
        product={product}
        config={config}
        productUrl={productUrl}
        size={size}
        color={color}
      />
    </div>
  );
}

// ─── Диалог заявки ────────────────────────────────────────────────────────────

const requestSchema = z.object({
  name: z.string().trim().min(1, "Укажите ваше имя"),
  contact: z.string().trim().min(3, "Укажите Telegram, телефон или email"),
  comment: z.string().trim().max(1500).optional(),
  personalDataConsent: z.boolean().refine((v) => v, PD_CONSENT_ERROR),
});

const measurementSchema = z
  .string()
  .trim()
  .regex(/^\d+(?:[.,]\d+)?$/, "Введите положительное число")
  .refine((value) => Number(value.replace(",", ".")) > 0, {
    message: "Введите положительное число",
  });

type RequestValues = z.infer<typeof requestSchema>;

/** Собирает контактные данные и мерки и отправляет заявку на изготовление. */
function MadeToOrderDialog({
  open,
  onOpenChange,
  product,
  config,
  productUrl,
  size,
  color,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  config: MadeToOrderConfig;
  productUrl: string;
  size: string;
  color: string;
}) {
  const [measures, setMeasures] = useState<Record<string, string>>({});
  const [measurementErrors, setMeasurementErrors] = useState<
    Record<string, string>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const submission = useRef<{ signature: string; id: string } | null>(null);
  const customSize = size === CUSTOM_SIZE;
  const requestSize = size;

  const form = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      name: "",
      contact: "",
      comment: "",
      personalDataConsent: false,
    },
  });

  async function onSubmit(data: RequestValues) {
    const errors: Record<string, string> = {};
    const filled: string[] = [];

    if (customSize) {
      for (const measurement of config.measurements) {
        const value = measures[measurement.id]?.trim();
        if (!value) continue;

        const result = measurementSchema.safeParse(value);
        if (!result.success) {
          errors[measurement.id] =
            result.error.issues[0]?.message ?? "Введите положительное число";
          continue;
        }

        filled.push(`${measurement.label}: ${result.data} см`);
      }
    }

    setMeasurementErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (customSize && filled.length === 0 && !data.comment) {
      toast.error(
        "Укажите хотя бы одну мерку или опишите размер в комментарии",
      );
      return;
    }

    const description = [
      `Изделие: ${product.name}`,
      `Ссылка: ${productUrl}`,
      `Размер: ${requestSize}`,
      customSize && filled.length ? `Мерки:\n${filled.join("\n")}` : null,
      `Цвет: ${color}`,
      data.comment ? `Комментарий: ${data.comment}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    setSubmitting(true);
    try {
      const fields = {
        name: data.name,
        contact: data.contact,
        description,
        productType: config.productType,
        size: requestSize,
        color,
        personalDataConsent: String(data.personalDataConsent) as "true",
      };
      // Повтор той же заявки идёт с тем же requestId: сервер не задвоит её
      const signature = JSON.stringify(fields);
      if (submission.current?.signature !== signature)
        submission.current = { signature, id: crypto.randomUUID() };
      const request = { ...fields, requestId: submission.current.id };

      let resData: { requestNumber: number };
      try {
        resData = await webApi.forms.submitCustomOrder(request);
      } catch (error) {
        if (!isServerError(error)) throw error;
        if (error instanceof CustomOrderConflictError)
          submission.current = null;
        toast.error(formErrorMessage(error, "Не удалось отправить заявку"));
        return;
      }

      toast.success(
        `Заявка №${resData.requestNumber} принята! Мастер свяжется с вами в рабочее время.`,
      );
      submission.current = null;
      reachGoal("custom_order_submitted", {
        location: "product",
        category: product.category,
      });
      reachGoal("made_to_order_submitted", { category: product.category });
      form.reset();
      setMeasures({});
      setMeasurementErrors({});
      onOpenChange(false);
    } catch {
      toast.error(
        "Ошибка соединения. Попробуйте ещё раз или напишите в Telegram.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-parchment max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-espresso font-normal">
            {config.cta}
          </DialogTitle>
          <DialogDescription className="text-taupe">
            {product.name} · размер: {requestSize} · цвет: {color}. Мастер
            проверит мерки, согласует детали и точную цену до начала работы.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            {customSize && (
              <div>
                <p className="label-caps text-[11px] text-taupe mb-2">
                  {product.category === "clothes"
                    ? "Ваши мерки, см"
                    : "Желаемые размеры, см"}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {config.measurements.map((m) => (
                    <div key={m.id} className="space-y-1">
                      <Label htmlFor={`mto-${m.id}`} className="text-[12px]">
                        {m.label}
                      </Label>
                      <Input
                        id={`mto-${m.id}`}
                        inputMode="decimal"
                        placeholder="см"
                        title={m.hint}
                        value={measures[m.id] ?? ""}
                        aria-describedby={
                          measurementErrors[m.id]
                            ? `mto-${m.id}-error`
                            : undefined
                        }
                        aria-invalid={Boolean(measurementErrors[m.id])}
                        onChange={(e) => {
                          const value = e.target.value;
                          setMeasures((prev) => ({
                            ...prev,
                            [m.id]: value,
                          }));

                          const result = measurementSchema.safeParse(value);
                          setMeasurementErrors((prev) => {
                            const { [m.id]: _error, ...remainingErrors } = prev;
                            if (!value.trim() || result.success) {
                              return remainingErrors;
                            }

                            return {
                              ...remainingErrors,
                              [m.id]:
                                result.error.issues[0]?.message ??
                                "Введите положительное число",
                            };
                          });
                        }}
                      />
                      {measurementErrors[m.id] && (
                        <p
                          id={`mto-${m.id}-error`}
                          className="text-[12px] text-destructive"
                        >
                          {measurementErrors[m.id]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Комментарий (необязательно)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder={
                        product.category === "clothes"
                          ? "Посадка, длина, к какому событию нужна вещь…"
                          : "Пожелания по размеру, цвету, срокам…"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Имя</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telegram / телефон</FormLabel>
                    <FormControl>
                      <Input placeholder="@username или +7…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
              className="rounded-full bg-terracotta text-parchment hover:bg-espresso h-12 label-caps-md"
            >
              {submitting ? "Отправляем…" : "Отправить мастеру"}
            </Button>
            <p className="text-taupe text-[11px] text-center">
              Оплата — только после согласования деталей. Изготовление{" "}
              {madeToOrderLeadTime(product)}.
            </p>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Мелочи ───────────────────────────────────────────────────────────────────

function Chip({
  active,
  accent,
  onClick,
  children,
}: {
  active: boolean;
  accent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full label-caps text-[11px] border transition-colors ${
        active
          ? "bg-espresso text-parchment border-espresso"
          : accent
            ? "border-terracotta/40 text-terracotta hover:bg-terracotta/10"
            : "border-espresso/15 text-espresso hover:border-espresso/40"
      }`}
    >
      {children}
    </button>
  );
}

function ScissorsIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8.5 7.5 20 18M8.5 16.5 20 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="transition-transform duration-200 group-open:rotate-180"
    >
      <path
        d="M3 6l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
