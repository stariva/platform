import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isOzonDeliveryConfigured } from "@/lib/ozon-delivery/auth";
import { checkout } from "@/lib/ozon-delivery/client";

export const runtime = "nodejs";

const deliverySchema = z.union([
  z.object({ method: z.literal("pickup"), pointId: z.string().min(1) }),
  z.object({
    method: z.literal("courier"),
    address: z.string().min(3),
    latitude: z.number(),
    longitude: z.number(),
  }),
]);

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.number().int().positive(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
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
    const result = await checkout(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[checkout/quote] Ошибка:", error);
    return NextResponse.json(
      { error: "Не удалось рассчитать стоимость доставки" },
      { status: 502 },
    );
  }
}
