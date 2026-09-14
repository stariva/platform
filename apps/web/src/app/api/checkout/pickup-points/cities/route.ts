import { NextResponse } from "next/server";
import { isOzonDeliveryConfigured } from "@/lib/ozon-delivery/auth";
import { groupPickupPointsByCity, sortCities } from "@/lib/ozon-delivery/city";
import { getCachedPickupPoints } from "@/lib/ozon-delivery/pickup-points-cache";

export const runtime = "nodejs";

export async function GET() {
  if (!isOzonDeliveryConfigured()) {
    return NextResponse.json(
      { error: "Доставка Ozon временно недоступна" },
      { status: 503 },
    );
  }

  try {
    const points = await getCachedPickupPoints();
    const byCity = groupPickupPointsByCity(points);
    const cities = sortCities([...byCity.keys()]).map((name) => ({
      name,
      count: byCity.get(name)?.length ?? 0,
    }));
    return NextResponse.json(
      { cities },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    console.error("[checkout/pickup-points/cities] Ошибка:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить список городов" },
      { status: 502 },
    );
  }
}
