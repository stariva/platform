import { ORPCError } from "@orpc/server";
import {
  count,
  courseAccess,
  desc,
  eq,
  orders,
  productOrders,
  session,
  user,
  workshops,
} from "@stariva/db";
import { z } from "zod";

import { adminProcedure, isAdminEmail } from "../../../orpc";

/**
 * Карточка пользователя: профиль, доступы к мастер-классам, заказы на
 * мастер-классы и на товары, число активных сессий.
 *
 * Бросает NOT_FOUND, если пользователя с таким id нет.
 */
export const byId = adminProcedure
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    const [found] = await context.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        username: user.username,
        bio: user.bio,
        language: user.language,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, input.id));
    if (!found) {
      throw new ORPCError("NOT_FOUND", { message: "Пользователь не найден" });
    }

    const [access, workshopOrders, catalogOrders, [sessions]] =
      await Promise.all([
        context.db
          .select({
            id: courseAccess.id,
            workshopSlug: courseAccess.workshopSlug,
            workshopTitle: workshops.title,
            orderId: courseAccess.orderId,
            grantedAt: courseAccess.grantedAt,
          })
          .from(courseAccess)
          .leftJoin(workshops, eq(workshops.slug, courseAccess.workshopSlug))
          .where(eq(courseAccess.userId, input.id))
          .orderBy(desc(courseAccess.grantedAt)),
        context.db
          .select({
            id: orders.id,
            workshopSlug: orders.workshopSlug,
            workshopTitle: workshops.title,
            amount: orders.amount,
            status: orders.status,
            createdAt: orders.createdAt,
            paidAt: orders.paidAt,
          })
          .from(orders)
          .leftJoin(workshops, eq(workshops.slug, orders.workshopSlug))
          .where(eq(orders.userId, input.id))
          .orderBy(desc(orders.createdAt)),
        context.db
          .select({
            id: productOrders.id,
            amountTotal: productOrders.amountTotal,
            status: productOrders.status,
            createdAt: productOrders.createdAt,
            paidAt: productOrders.paidAt,
          })
          .from(productOrders)
          .where(eq(productOrders.userId, input.id))
          .orderBy(desc(productOrders.createdAt)),
        context.db
          .select({ total: count() })
          .from(session)
          .where(eq(session.userId, input.id)),
      ]);

    return {
      ...found,
      isAdmin: isAdminEmail(found.email),
      sessionsCount: sessions?.total ?? 0,
      access,
      // Суммы в копейках — переводим в рубли, как в остальной админке
      workshopOrders: workshopOrders.map(({ amount, ...order }) => ({
        ...order,
        amount: amount / 100,
      })),
      productOrders: catalogOrders.map(({ amountTotal, ...order }) => ({
        ...order,
        amountTotal: amountTotal / 100,
      })),
    };
  });
