import { customOrderRequestSchema } from "@stariva/web-api/contract";
import type { z } from "zod";
import { attributionSchema } from "@/lib/campaign-attribution";

/**
 * Заявка в том виде, в каком она хранится в базе: поля формы из контракта
 * API витрины плюс рекламный источник из cookie. Источник берём только из
 * нашей cookie — клиент его не присылает.
 */
export const orderRequestSchema = customOrderRequestSchema.extend({
  attribution: attributionSchema.optional(),
});

export type OrderRequest = z.infer<typeof orderRequestSchema>;
