import { NextResponse } from "next/server";
import { isOzonDeliveryConfigured } from "@/lib/ozon-delivery/auth";
import { extractCity } from "@/lib/ozon-delivery/city";
import { getCachedPickupPoints } from "@/lib/ozon-delivery/pickup-points-cache";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isOzonDeliveryConfigured()) {
    return NextResponse.json(
      { error: "Доставка Ozon временно недоступна" },
      { status: 503 },
    );
  }

  const city = new URL(request.url).searchParams.get("city");
  if (!city) {
    return NextResponse.json({ error: "Не указан город" }, { status: 400 });
  }

  try {
    const points = await getCachedPickupPoints();
    const pointsInCity = points.filter((p) => extractCity(p.address) === city);
    return NextResponse.json(
      { points: pointsInCity },
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
