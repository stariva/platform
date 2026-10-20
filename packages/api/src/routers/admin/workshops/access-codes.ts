import { ORPCError } from "@orpc/server";
import {
  and,
  count,
  desc,
  eq,
  isNull,
  orders,
  workshopAccessCodes,
  workshops,
} from "@stariva/db";
import { currentWorkshopPrice } from "@stariva/validators";
import { formatAccessCode, generateAccessCode } from "@stariva/web-api";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/** Где продан курс. Пока только Ярмарка Мастеров. */
const CHANNELS = ["livemaster"] as const;

// Совпадение случайного кода с уже выданным — почти невероятно, но бывает
const ISSUE_ATTEMPTS = 5;

/**
 * Выдаёт одноразовый код доступа к мастер-классу для покупателя с Ярмарки
 * Мастеров. Цену курса фиксирует сразу: она уйдёт в заказ при активации.
 *
 * @example client.admin.workshops.issueAccessCode({ workshopSlug: "elka-makrame", note: "Заказ 12345678" })
 */
export const issueAccessCode = adminProcedure
  .input(
    z.object({
      workshopSlug: z.string().trim().min(1).max(200),
      channel: z.enum(CHANNELS).default("livemaster"),
      note: z.string().trim().max(200).optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const [workshop] = await context.db
      .select({
        slug: workshops.slug,
        price: workshops.price,
        priceAfterRelease: workshops.priceAfterRelease,
        releaseAt: workshops.releaseAt,
      })
      .from(workshops)
      .where(eq(workshops.slug, input.workshopSlug));
    if (!workshop) {
      throw new ORPCError("NOT_FOUND", { message: "Мастер-класс не найден" });
    }
    // Та же цена, что сейчас на сайте: после старта — уже без скидки предзаказа
    const amount = currentWorkshopPrice(workshop);

    for (let attempt = 0; attempt < ISSUE_ATTEMPTS; attempt++) {
      const code = generateAccessCode();
      const [row] = await context.db
        .insert(workshopAccessCodes)
        .values({
          id: crypto.randomUUID(),
          code,
          workshopSlug: workshop.slug,
          channel: input.channel,
          amount,
          note: input.note || null,
        })
        .onConflictDoNothing({ target: workshopAccessCodes.code })
        .returning({ id: workshopAccessCodes.id });
      if (row) return { id: row.id, code: formatAccessCode(code) };
    }
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Не удалось подобрать свободный код — попробуйте ещё раз",
    });
  });

/**
 * Выданные коды, свежие сверху: кому выдан (пометка), активирован ли и на
 * какую почту.
 *
 * @example client.admin.workshops.accessCodes({ workshop: "elka-makrame", limit: 50, offset: 0 })
 */
export const accessCodesList = adminProcedure
  .input(
    z.object({
      workshop: z.string().trim().min(1).max(200).optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, input }) => {
    const where = input.workshop
      ? eq(workshopAccessCodes.workshopSlug, input.workshop)
      : undefined;
    const [rows, [totals]] = await Promise.all([
      context.db
        .select({
          id: workshopAccessCodes.id,
          code: workshopAccessCodes.code,
          workshopSlug: workshopAccessCodes.workshopSlug,
          workshopTitle: workshops.title,
          channel: workshopAccessCodes.channel,
          amount: workshopAccessCodes.amount,
          note: workshopAccessCodes.note,
          createdAt: workshopAccessCodes.createdAt,
          redeemedAt: workshopAccessCodes.redeemedAt,
          orderId: workshopAccessCodes.orderId,
          redeemedEmail: orders.contactEmail,
        })
        .from(workshopAccessCodes)
        .leftJoin(
          workshops,
          eq(workshops.slug, workshopAccessCodes.workshopSlug),
        )
        .leftJoin(orders, eq(orders.id, workshopAccessCodes.orderId))
        .where(where)
        .orderBy(
          desc(workshopAccessCodes.createdAt),
          desc(workshopAccessCodes.id),
        )
        .limit(input.limit)
        .offset(input.offset),
      context.db
        .select({ total: count() })
        .from(workshopAccessCodes)
        .where(where),
    ]);
    return {
      items: rows.map(({ code, amount, ...row }) => ({
        ...row,
        code: formatAccessCode(code),
        // Копейки → рубли, как в остальной админке
        amount: amount / 100,
      })),
      total: totals?.total ?? 0,
    };
  });

/**
 * Удаляет код, который ещё не активировали: выдан по ошибке или покупатель
 * отменил заказ на Ярмарке. Активированный код остаётся — за ним заказ.
 *
 * @example client.admin.workshops.removeAccessCode({ id: "code_1" })
 */
export const removeAccessCode = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const removed = await context.db
      .delete(workshopAccessCodes)
      .where(
        and(
          eq(workshopAccessCodes.id, input.id),
          isNull(workshopAccessCodes.redeemedAt),
        ),
      )
      .returning({ id: workshopAccessCodes.id });
    if (removed.length === 0) {
      throw new ORPCError("CONFLICT", {
        message: "Код уже активирован или удалён",
      });
    }
    return { ok: true as const };
  });
