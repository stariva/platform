import { ORPCError } from "@orpc/server";
import {
  detectImageType,
  isPublicStorageConfigured,
  PRODUCT_IMAGE_TYPES,
  uploadPublicObject,
  workshopImageKey,
} from "@stariva/storage";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

const MAX_BYTES = 15 * 1024 * 1024;

/** Кладёт обложку или превью в публичный бакет и возвращает адрес. */
export const uploadImage = adminProcedure
  .input(
    z.object({
      slug: z
        .string()
        .min(1)
        .max(120)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      file: z
        .file()
        .max(MAX_BYTES, "Картинка больше 15 МБ")
        .mime(
          Object.keys(PRODUCT_IMAGE_TYPES) as [string, ...string[]],
          "Нужен JPEG, PNG, WebP, AVIF или GIF",
        ),
    }),
  )
  .handler(async ({ input }) => {
    if (!isPublicStorageConfigured()) {
      throw new ORPCError("PRECONDITION_FAILED", {
        message: "Публичный бакет для картинок не настроен",
      });
    }
    const bytes = new Uint8Array(await input.file.arrayBuffer());
    // Content-Type от браузера не доверяем: тип определяем по содержимому
    const contentType = detectImageType(bytes);
    if (!contentType) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Файл не похож на JPEG, PNG, WebP, AVIF или GIF",
      });
    }
    const key = workshopImageKey(input.slug, bytes, contentType);
    return { url: await uploadPublicObject(key, bytes, contentType) };
  });
