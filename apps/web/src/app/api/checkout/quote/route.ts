import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveCatalogItems } from "@/lib/commerce/catalog";
import { isOzonDeliveryConfigured } from "@/lib/ozon-delivery/auth";
import { checkout } from "@/lib/ozon-delivery/client";

export const runtime = "nodejs";

const deliverySchema = z.object({
  method: z.literal("pickup"),
  pointId: z.string().min(1),
});

const bodySchema = z.object({
  contactPhone: z.string().min(5).max(20),
  items: z
    .array(
      z.object({
        productSlug: z.string().min(1),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .min(1)
    .max(100),
  delivery: deliverySchema,
});

export async function POST(request: NextRequest) {
  if (!isOzonDeliveryConfigured()) {
    return NextResponse.json(
      { error: "Доставка Ozon временно недоступна" },
      { status: 503 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  try {
    const items = await resolveCatalogItems(parsed.data.items);
    const result = await checkout({
      items: items.map((item) => ({
        sku: item.ozonSku,
        quantity: item.quantity,
      })),
      delivery: parsed.data.delivery,
      buyerPhone: parsed.data.contactPhone,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[checkout/quote] Ошибка:", error);
    return NextResponse.json(
      { error: "Не удалось рассчитать стоимость доставки" },
      { status: 502 },
    );
  }
}
