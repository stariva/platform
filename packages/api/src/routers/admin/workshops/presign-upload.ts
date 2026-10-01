import { ORPCError } from "@orpc/server";
import {
  createUploadUrl,
  isStorageConfigured,
  workshopMaterialKey,
  workshopVideoKey,
} from "@stariva/storage";
import {
  WORKSHOP_MATERIAL_MAX_BYTES,
  WORKSHOP_MATERIAL_TYPES,
  WORKSHOP_VIDEO_MAX_BYTES,
  WORKSHOP_VIDEO_TYPES,
} from "@stariva/validators";
import { z } from "zod";

import { adminProcedure } from "../../../orpc";

const slug = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/**
 * Выдаёт ссылку, по которой браузер сам кладёт видео или PDF в закрытый
 * бакет. Ключ строит сервер, поэтому писать можно только в папку курса.
 * В курс файл попадает при сохранении формы.
 */
export const presignUpload = adminProcedure
  .input(
    z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("video"),
        slug,
        lessonId: z.string().min(1).max(100),
        contentType: z.enum(WORKSHOP_VIDEO_TYPES),
        size: z
          .number()
          .int()
          .positive()
          .max(WORKSHOP_VIDEO_MAX_BYTES, "Видео больше 4 ГБ"),
      }),
      z.object({
        kind: z.literal("material"),
        slug,
        fileName: z.string().min(1).max(300),
        contentType: z.enum(WORKSHOP_MATERIAL_TYPES),
        size: z
          .number()
          .int()
          .positive()
          .max(WORKSHOP_MATERIAL_MAX_BYTES, "PDF больше 50 МБ"),
      }),
    ]),
  )
  .handler(async ({ input }) => {
    if (!isStorageConfigured()) {
      throw new ORPCError("PRECONDITION_FAILED", {
        message: "Хранилище для видео не настроено",
      });
    }
    const key =
      input.kind === "video"
        ? workshopVideoKey(input.slug, input.lessonId, input.contentType)
        : workshopMaterialKey(input.slug, input.fileName);
    return {
      key,
      uploadUrl: await createUploadUrl(key, input.contentType),
    };
  });
