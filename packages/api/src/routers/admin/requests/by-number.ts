import { ORPCError } from "@orpc/server";
import { customOrderRequests, eq } from "@stariva/db";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { requestFields } from "./fields";

/**
 * Заявка целиком: текст, как он ушёл мастеру в Telegram и на почту
 * (со всеми полями формы, источником и согласием), и фото-референс.
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

    const { photoBase64, photoType, ...request } = found;
    return {
      ...request,
      // Фото небольшое (до 8 МБ) и смотрит его только мастер — отдаём сразу.
      photoUrl: photoBase64
        ? `data:${photoType ?? "image/jpeg"};base64,${photoBase64}`
        : null,
    };
  });
