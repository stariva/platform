import { ORPCError } from "@orpc/server";
import { getObjectBytes, isStorageConfigured } from "@stariva/storage";
import { EncryptedPDFError } from "pdf-lib";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";
import { appendCodePage } from "../../../pdf/code-page";

/**
 * PDF-бриф для Ярмарки Мастеров: файл курса из закрытого бакета с
 * дописанной последней страницей — QR и адрес stariva.ru/code. Ссылок в чате
 * Ярмарки слать нельзя, так покупатель найдёт, где ввести код.
 */
export const livemasterPdf = adminProcedure
  .input(
    z.object({
      key: z
        .string()
        .max(500)
        .regex(/^workshops\/([a-z0-9-]+)\/materials\/[A-Za-z0-9_-]+\.pdf$/),
    }),
  )
  .handler(async ({ input }) => {
    if (!isStorageConfigured()) {
      throw new ORPCError("PRECONDITION_FAILED", {
        message: "Хранилище не настроено",
      });
    }
    const slug = input.key.split("/")[1];
    let pdf: Uint8Array<ArrayBuffer>;
    try {
      pdf = await appendCodePage(await getObjectBytes(input.key));
    } catch (err) {
      // Файл удалили из бакета или ключ устарел
      if ((err as Error).name === "NoSuchKey") {
        throw new ORPCError("NOT_FOUND", {
          message: "Файл не найден в хранилище — загрузите PDF заново",
        });
      }
      if (err instanceof EncryptedPDFError) {
        throw new ORPCError("BAD_REQUEST", {
          message: "PDF защищён паролем — сохраните бриф без защиты",
        });
      }
      throw err;
    }
    return new File([pdf], `${slug}-yarmarka.pdf`, {
      type: "application/pdf",
    });
  });
