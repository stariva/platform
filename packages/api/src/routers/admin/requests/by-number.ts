import { ORPCError } from "@orpc/server";
import { customOrderRequests, eq, productOrders } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { requestFields } from "./fields";

/**
 * Заявка целиком: текст, как он ушёл мастеру в Telegram и на почту
 * (со всеми полями формы, источником и согласием), фото-референс и заказ
 * на сайте, если по заявке выставлен счёт.
 *
 * Бросает NOT_FOUND, если заявки с таким номером нет.
 */
export const byNumber = adminProcedure
  .input(z.object({ number: z.number().int().positive() }))
  .handler(async ({ context, input }) => {
    const [found] = await context.db
      .select({
        ...requestFields,
        message: customOrderRequests.message,
        visitor: customOrderRequests.visitor,
        photoBase64: customOrderRequests.photoBase64,
        photoType: customOrderRequests.photoType,
      })
      .from(customOrderRequests)
      .where(eq(customOrderRequests.number, input.number));
    if (!found) {
      throw new ORPCError("NOT_FOUND", { message: "Заявка не найдена" });
    }

    const [order] = await context.db
      .select({
        id: productOrders.id,
        number: productOrders.number,
        status: productOrders.status,
        amountTotal: productOrders.amountTotal,
      })
      .from(productOrders)
      .where(eq(productOrders.requestNumber, input.number));

    const { photoBase64, photoType, ...request } = found;
    return {
      ...request,
      order: order ? { ...order, amountTotal: order.amountTotal / 100 } : null,
      // Фото небольшое (до 8 МБ) и смотрит его только мастер — отдаём сразу.
      photoUrl: photoBase64
        ? `data:${photoType ?? "image/jpeg"};base64,${photoBase64}`
        : null,
    };
  });
