import { NextResponse } from "next/server";
import { isOzonDeliveryConfigured } from "@/lib/ozon-delivery/auth";
import { getCachedPickupPoints } from "@/lib/ozon-delivery/pickup-points-cache";
import { haversineKm } from "@/lib/geo";

export const runtime = "nodejs";

// Ищем ближайшие пункты выдачи вокруг города, который выбрал пользователь.
// Радиус расширяем по шагам: в крупных городах хватает и 30 км, а для
// пользователей из небольших населённых пунктов без пункта поблизости
// показываем ближайшие из более широкого круга, а не пустой список.
const RADIUS_TIERS_KM = [30, 100, 300];
const FALLBACK_LIMIT = 20;

export async function GET(request: Request) {
  if (!isOzonDeliveryConfigured()) {
    return NextResponse.json(
      { error: "Доставка Ozon временно недоступна" },
      { status: 503 },
    );
  }

  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "Не указаны координаты города" },
      { status: 400 },
    );
  }

  try {
    const points = await getCachedPickupPoints();
    const withDistance = points
      .map((point) => ({
        point,
        distanceKm: haversineKm(lat, lon, point.latitude, point.longitude),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    for (const radiusKm of RADIUS_TIERS_KM) {
      const nearby = withDistance.filter((p) => p.distanceKm <= radiusKm);
      if (nearby.length > 0) {
        return NextResponse.json(
          {
            points: nearby.map((p) => p.point),
            radiusKm,
            expanded: radiusKm !== RADIUS_TIERS_KM[0],
          },
          { headers: { "Cache-Control": "private, max-age=300" } },
        );
      }
    }

    return NextResponse.json(
      {
        points: withDistance.slice(0, FALLBACK_LIMIT).map((p) => p.point),
        radiusKm: null,
        expanded: true,
      },
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
