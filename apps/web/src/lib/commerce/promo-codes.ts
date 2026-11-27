import { db, promoCodes } from "@stariva/db";
import { normalizePromoCode, promoDiscountKopecks } from "@stariva/validators";
import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";

export class PromoCodeInvalidError extends Error {
  constructor(readonly reason: string) {
    super(`promo_code_invalid:${reason}`);
    this.name = "PromoCodeInvalidError";
  }
}

type PromoCodeRow = typeof promoCodes.$inferSelect;
type PromoDb = Pick<typeof db, "select" | "update">;

export interface PromoEvaluation {
  valid: boolean;
  reason: string | null;
  code: string | null;
  discountType: "percent" | "fixed" | null;
  discountValue: number | null;
  discountKopecks: number | null;
}

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function evaluatePromoCode(
  promo: PromoCodeRow | null,
  productsKopecks: number,
  now = new Date(),
): PromoEvaluation {
  const invalid = (reason: string): PromoEvaluation => ({
    valid: false,
    reason,
    code: promo?.code ?? null,
    discountType: promo?.discountType ?? null,
    discountValue: promo?.discountValue ?? null,
    discountKopecks: null,
  });

  if (!promo) return invalid("Промокод не найден");
  if (!promo.active) return invalid("Промокод отключён");
  if (promo.startsAt && promo.startsAt > now) {
    return invalid("Промокод ещё не начал действовать");
  }
  if (promo.endsAt && promo.endsAt <= now) {
    return invalid("Срок действия промокода закончился");
  }
  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
    return invalid("Лимит использования промокода исчерпан");
  }
  if (promo.minOrderAmount !== null && productsKopecks < promo.minOrderAmount) {
    return invalid(
      `Промокод действует на заказ от ${money.format(promo.minOrderAmount / 100)}`,
    );
  }

  const discountKopecks = promoDiscountKopecks(promo, productsKopecks);
  if (discountKopecks <= 0)
    return invalid("Промокод не даёт скидку на этот заказ");
  if (discountKopecks >= productsKopecks) {
    return invalid("Промокод не может покрывать всю стоимость изделий");
  }

  return {
    valid: true,
    reason: null,
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    discountKopecks,
  };
}

export async function validateStoredPromoCode(
  rawCode: string,
  productsKopecks: number,
): Promise<PromoEvaluation> {
  const code = normalizePromoCode(rawCode);
  const [promo] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, code))
    .limit(1);
  return evaluatePromoCode(promo ?? null, productsKopecks);
}

export async function reservePromoCode(
  tx: PromoDb,
  rawCode: string,
  productsKopecks: number,
): Promise<{ promo: PromoCodeRow; discountKopecks: number }> {
  const code = normalizePromoCode(rawCode);
  const now = new Date();
  const [reserved] = await tx
    .update(promoCodes)
    .set({ usedCount: sql`${promoCodes.usedCount} + 1` })
    .where(
      and(
        eq(promoCodes.code, code),
        eq(promoCodes.active, true),
        or(isNull(promoCodes.startsAt), lte(promoCodes.startsAt, now)),
        or(isNull(promoCodes.endsAt), gt(promoCodes.endsAt, now)),
        or(
          isNull(promoCodes.usageLimit),
          sql`${promoCodes.usedCount} < ${promoCodes.usageLimit}`,
        ),
        or(
          isNull(promoCodes.minOrderAmount),
          lte(promoCodes.minOrderAmount, productsKopecks),
        ),
      ),
    )
    .returning();

  if (!reserved) {
    const [promo] = await tx
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.code, code))
      .limit(1);
    throw new PromoCodeInvalidError(
      evaluatePromoCode(promo ?? null, productsKopecks, now).reason ??
        "Промокод больше не действует",
    );
  }

  const evaluation = evaluatePromoCode(reserved, productsKopecks, now);
  if (!evaluation.valid || evaluation.discountKopecks === null) {
    throw new PromoCodeInvalidError(
      evaluation.reason ?? "Промокод больше не действует",
    );
  }
  return { promo: reserved, discountKopecks: evaluation.discountKopecks };
}

export async function releasePromoCodeReservation(
  target: PromoDb,
  promoCodeId: string,
): Promise<void> {
  await target
    .update(promoCodes)
    .set({ usedCount: sql`greatest(${promoCodes.usedCount} - 1, 0)` })
    .where(eq(promoCodes.id, promoCodeId));
}

export function discountedReceiptItems(
  items: { name: string; price: number; quantity: number }[],
  amountDiscount: number,
): { name: string; amount: number; quantity: number }[] {
  if (amountDiscount <= 0) {
    return items.map((item) => ({
      name: item.name,
      amount: item.price,
      quantity: item.quantity,
    }));
  }

  const productsTotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  if (amountDiscount >= productsTotal) {
    throw new Error("promo_discount_covers_products");
  }

  let distributed = 0;
  return items.flatMap((item, index) => {
    const lineTotal = item.price * item.quantity;
    const lineDiscount =
      index === items.length - 1
        ? amountDiscount - distributed
        : Math.floor((amountDiscount * lineTotal) / productsTotal);
    distributed += lineDiscount;
    const netTotal = lineTotal - lineDiscount;
    if (netTotal <= 0) return [];

    const unit = Math.floor(netTotal / item.quantity);
    const remainder = netTotal % item.quantity;
    if (remainder === 0) {
      return [{ name: item.name, amount: unit, quantity: item.quantity }];
    }
    return Array.from({ length: item.quantity }, (_, unitIndex) => ({
      name: item.name,
      amount: unit + (unitIndex < remainder ? 1 : 0),
      quantity: 1,
    }));
  });
}
