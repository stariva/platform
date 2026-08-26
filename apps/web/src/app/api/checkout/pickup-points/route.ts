import { NextResponse } from "next/server";
import { isOzonDeliveryConfigured } from "@/lib/ozon-delivery/auth";
import { listPickupPoints } from "@/lib/ozon-delivery/client";

export const runtime = "nodejs";

export async function GET() {
  if (!isOzonDeliveryConfigured()) {
    return NextResponse.json(
      { error: "Доставка Ozon временно недоступна" },
      { status: 503 },
    );
  }

  try {
    const points = await listPickupPoints();
    return NextResponse.json(
      { points },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    console.error("[checkout/pickup-points] Ошибка:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить пункты выдачи" },
      { status: 502 },
    );
  }
}
