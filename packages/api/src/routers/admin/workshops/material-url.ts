import { ORPCError } from "@orpc/server";
import { getDownloadUrl, isStorageConfigured } from "@stariva/storage";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

/** Ссылка живёт недолго: её открывают сразу по нажатию. */
const LINK_TTL_SECONDS = 5 * 60;

/**
 * Ссылка на PDF курса, чтобы открыть его из админки. Отдаём только файлы из
 * папок материалов: видео и прочее этим путём не скачать.
 */
export const materialUrl = adminProcedure
  .input(
    z.object({
      key: z
        .string()
        .max(500)
        .regex(/^workshops\/[a-z0-9-]+\/materials\/[A-Za-z0-9_-]+\.pdf$/),
    }),
  )
  .handler(async ({ input }) => {
    if (!isStorageConfigured()) {
      throw new ORPCError("PRECONDITION_FAILED", {
        message: "Хранилище не настроено",
      });
    }
    return {
      url: await getDownloadUrl(input.key, { expiresIn: LINK_TTL_SECONDS }),
    };
  });
