import { z } from "zod";
import { env } from "@/env";

const accessTokenSchema = z.string().min(1);

/** Ozon Seller API requires a seller-authorized application Bearer token. */
export function isOzonDeliveryConfigured(): boolean {
  return accessTokenSchema.safeParse(env.OZON_DELIVERY_ACCESS_TOKEN).success;
}

export function getOzonDeliveryToken(): string {
  const parsed = accessTokenSchema.safeParse(env.OZON_DELIVERY_ACCESS_TOKEN);
  if (!parsed.success) throw new Error("ozon_delivery_not_configured");
  return parsed.data;
}
