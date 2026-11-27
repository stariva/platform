import { ORPCError } from "@orpc/server";
import { desc, eq, promoCodes } from "@stariva/db";
import {
  normalizePromoCode,
  parseMoscowDateTime,
  promoCodeFormSchema,
} from "@stariva/validators";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

function isCodeTaken(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string; constraint?: string } })
    ?.cause;
  const pg = cause ?? (error as { code?: string; constraint?: string });
  return pg?.code === "23505" && pg.constraint === "promo_codes_code_idx";
}

function dateOrNull(value: string): Date | null {
  return value ? parseMoscowDateTime(value) : null;
}

function formToRow(values: z.infer<typeof promoCodeFormSchema>) {
  return {
    code: normalizePromoCode(values.code),
    description: values.description,
    discountType: values.discountType,
    discountValue:
      values.discountType === "percent"
        ? values.discountValue
        : Math.round(values.discountValue * 100),
    active: values.active,
    startsAt: dateOrNull(values.startsAt),
    endsAt: dateOrNull(values.endsAt),
    usageLimit: values.usageLimit,
    minOrderAmount:
      values.minOrderAmount === null
        ? null
        : Math.round(values.minOrderAmount * 100),
  };
}

/** Промокоды витрины, свежие сверху. */
export const list = adminProcedure.handler(async ({ context }) => {
  return context.db
    .select()
    .from(promoCodes)
    .orderBy(desc(promoCodes.createdAt), desc(promoCodes.id));
});

/** Создаёт промокод (без id) или сохраняет существующий. */
export const save = adminProcedure
  .input(
    z.object({
      id: z.string().min(1).optional(),
      values: promoCodeFormSchema,
    }),
  )
  .handler(async ({ context, input }) => {
    const fields = formToRow(input.values);
    try {
      if (!input.id) {
        const [created] = await context.db
          .insert(promoCodes)
          .values(fields)
          .returning({ id: promoCodes.id });
        if (!created) throw new Error("promo_code_insert_failed");
        return { id: created.id };
      }

      const [updated] = await context.db
        .update(promoCodes)
        .set(fields)
        .where(eq(promoCodes.id, input.id))
        .returning({ id: promoCodes.id });
      if (!updated) {
        throw new ORPCError("NOT_FOUND", { message: "Промокод не найден" });
      }
      return { id: updated.id };
    } catch (error) {
      if (isCodeTaken(error)) {
        throw new ORPCError("CONFLICT", {
          message: "Такой промокод уже существует",
        });
      }
      throw error;
    }
  });

/** Удаляет промокод; в уже созданных заказах остаётся текстовая копия кода. */
export const remove = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [removed] = await context.db
      .delete(promoCodes)
      .where(eq(promoCodes.id, input.id))
      .returning({ id: promoCodes.id });
    if (!removed) {
      throw new ORPCError("NOT_FOUND", { message: "Промокод не найден" });
    }
    return { id: removed.id };
  });

export const adminPromoCodesRouter = {
  list,
  save,
  remove,
};
