import { z } from "zod";
import { parseMoscowDateTime } from "./workshop";

/** Промокод: латиница, цифры и дефисы, 3–40 символов. */
export const PROMO_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/;

/** Пользовательский ввод → канонический код, под которым он хранится в БД. */
export function normalizePromoCode(value: string): string {
  return value.replace(/\s+/g, "").trim().toUpperCase();
}

/** Максимум для integer в PostgreSQL, сумма хранится в копейках. */
const MAX_RUBLES = 21_474_836;

const nullableRubles = z
  .number()
  .positive("Сумма должна быть больше нуля")
  .max(MAX_RUBLES)
  .refine(
    (price) => Math.abs(price * 100 - Math.round(price * 100)) < 1e-6,
    "Сумма должна содержать не больше двух знаков после запятой",
  )
  .nullable();

const moscowDateTime = z
  .string()
  .refine(
    (value) => value === "" || parseMoscowDateTime(value) !== null,
    "Укажите дату и время",
  );

/**
 * Форма промокода в админке. Даты — значения input type="datetime-local"
 * по Москве; пустая строка — без ограничения. `discountValue` — проценты
 * или рубли в зависимости от `discountType`.
 */
export const promoCodeFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Код должен быть не короче 3 символов")
      .max(40, "Код должен быть не длиннее 40 символов")
      .regex(PROMO_CODE_PATTERN, "Только латиница, цифры и дефисы"),
    description: z.string().trim().max(300),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z
      .number({ error: "Укажите скидку" })
      .positive("Скидка должна быть больше нуля")
      .max(MAX_RUBLES),
    active: z.boolean(),
    startsAt: moscowDateTime,
    endsAt: moscowDateTime,
    usageLimit: z.number().int().positive().max(1_000_000).nullable(),
    minOrderAmount: nullableRubles,
  })
  .superRefine((value, ctx) => {
    if (value.discountType === "percent") {
      if (!Number.isInteger(value.discountValue)) {
        ctx.addIssue({
          code: "custom",
          path: ["discountValue"],
          message: "Процент должен быть целым числом",
        });
      }
      if (value.discountValue > 100) {
        ctx.addIssue({
          code: "custom",
          path: ["discountValue"],
          message: "Процент не может быть больше 100",
        });
      }
    } else if (
      Math.abs(
        value.discountValue * 100 - Math.round(value.discountValue * 100),
      ) >= 1e-6
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "Сумма должна содержать не больше двух знаков после запятой",
      });
    }

    const startsAt = value.startsAt
      ? parseMoscowDateTime(value.startsAt)
      : null;
    const endsAt = value.endsAt ? parseMoscowDateTime(value.endsAt) : null;
    if (startsAt && endsAt && endsAt <= startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Окончание должно быть позже начала",
      });
    }
  });

export type PromoCodeFormValues = z.infer<typeof promoCodeFormSchema>;

export const EMPTY_PROMO_CODE: PromoCodeFormValues = {
  code: "",
  description: "",
  discountType: "percent",
  discountValue: 10,
  active: true,
  startsAt: "",
  endsAt: "",
  usageLimit: null,
  minOrderAmount: null,
};

/** Размер скидки в копейках; никогда не больше стоимости изделий. */
export function promoDiscountKopecks(
  promo: { discountType: "percent" | "fixed"; discountValue: number },
  productsKopecks: number,
): number {
  if (productsKopecks <= 0) return 0;
  const discount =
    promo.discountType === "percent"
      ? Math.floor((productsKopecks * promo.discountValue) / 100)
      : promo.discountValue;
  return Math.max(0, Math.min(productsKopecks, discount));
}
