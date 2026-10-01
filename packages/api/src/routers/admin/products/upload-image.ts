import { ORPCError } from "@orpc/server";
import {
  isPublicStorageConfigured,
  PRODUCT_IMAGE_TYPES,
  productImageKey,
  uploadPublicObject,
} from "@stariva/storage";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Загружает фото в публичный бакет и возвращает его адрес. В товар фото
 * попадает при сохранении формы. Для ещё не созданного товара — в drafts/.
 */
export const uploadImage = adminProcedure
  .input(
    z.object({
      productId: z.string().min(1).optional(),
      file: z
        .file()
        .max(MAX_BYTES, "Фото больше 15 МБ")
        .mime(
          Object.keys(PRODUCT_IMAGE_TYPES) as [string, ...string[]],
          "Нужен JPEG, PNG, WebP, AVIF или GIF",
        ),
    }),
  )
  .handler(async ({ input }) => {
    if (!isPublicStorageConfigured()) {
      throw new ORPCError("PRECONDITION_FAILED", {
        message: "Публичный бакет для фото не настроен",
      });
    }
    const bytes = new Uint8Array(await input.file.arrayBuffer());
    const key = productImageKey(
      input.productId ?? "drafts",
      bytes,
      input.file.type,
    );
    return { url: await uploadPublicObject(key, bytes, input.file.type) };
  });
