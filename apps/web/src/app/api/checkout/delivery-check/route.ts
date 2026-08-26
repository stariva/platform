import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isOzonDeliveryConfigured } from "@/lib/ozon-delivery/auth";
import { checkDeliveryAvailable } from "@/lib/ozon-delivery/client";

export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().min(5).max(20),
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
    return NextResponse.json({ error: "Укажите телефон" }, { status: 400 });
  }

  try {
    const result = await checkDeliveryAvailable(parsed.data.phone);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[checkout/delivery-check] Ошибка:", error);
    return NextResponse.json(
      { error: "Не удалось проверить доступность доставки" },
      { status: 502 },
    );
  }
}
