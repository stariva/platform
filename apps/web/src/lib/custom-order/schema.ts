import { z } from "zod";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
export const attributionSchema = z.object(
  Object.fromEntries(
    ATTRIBUTION_KEYS.map((key) => [key, z.string().trim().max(120).optional()]),
  ),
);
export const orderRequestSchema = z.object({
  requestId: z.uuid().optional(),
  name: z.string().trim().max(120).optional().default(""),
  contact: z.string().trim().min(3, "Укажите контакт для связи").max(200),
  description: z
    .string()
    .trim()
    .min(5, "Опишите, что хотите заказать")
    .max(3000),
  productType: z.string().max(60).optional(),
  size: z.string().max(60).optional(),
  measurements: z.string().trim().max(500).optional(),
  measurementHelp: z.enum(["true", "false"]).optional(),
  color: z.string().max(60).optional(),
  complexity: z.string().max(60).optional(),
  budget: z.string().trim().max(100).optional(),
  estimateMin: z.coerce.number().finite().nonnegative().optional(),
  estimateMax: z.coerce.number().finite().nonnegative().optional(),
  attribution: attributionSchema.optional(),
  personalDataConsent: z.literal("true", {
    error: "Нужно согласие на обработку персональных данных",
  }),
});
export type OrderRequest = z.infer<typeof orderRequestSchema>;
export function validatePhoto(photo: {
  size: number;
  type: string;
}): string | null {
  if (photo.size > MAX_PHOTO_BYTES)
    return "Фото слишком большое. Выберите файл до 8 МБ.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type))
    return "Выберите фото в формате JPG, PNG или WebP.";
  return null;
}
