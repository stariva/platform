import { NextResponse } from "next/server";
import { haversineKm } from "@/lib/geo";
import { isOzonDeliveryConfigured } from "@/lib/ozon-delivery/auth";
import {
  getCachedPickupPoints,
  getCachedPickupPointsInfo,
} from "@/lib/ozon-delivery/pickup-points-cache";
import type {
  PickupPoint,
  PickupPointLocation,
  PickupPointsNearbyResponse,
} from "@/lib/ozon-delivery/types";

export const runtime = "nodejs";

// Ищем ближайшие пункты выдачи вокруг адреса, который выбрал покупатель.
// Радиус расширяем по шагам: в крупных городах хватает и 30 км, а для
// покупателей из небольших населённых пунктов без пункта поблизости
// показываем ближайшие из более широкого круга, а не пустой список.
const RADIUS_TIERS_KM = [30, 100, 300];
const FALLBACK_LIMIT = 20;
// В Москве в радиусе 30 км — тысячи пунктов; покупателю нужны ближайшие,
// а карте хватает этого количества, чтобы можно было подвигать её вокруг.
const MAX_LOCATIONS = 1500;
// Для ближайших пунктов сразу отдаём адреса, чтобы список не мигал.
const NEAREST_WITH_DETAILS = 12;

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
  if (
    !params.get("lat") ||
    !params.get("lon") ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return NextResponse.json(
      { error: "Не указаны координаты адреса" },
      { status: 400 },
    );
  }

  try {
    // Точек по стране десятки тысяч: считаем расстояния в типизированный
    // массив и сортируем только попавшие в радиус, а не весь список —
    // иначе каждый запрос аллоцирует десятки тысяч объектов.
    const points = await getCachedPickupPoints();
    const distances = new Float64Array(points.length);
    let nearestKm = Infinity;
    for (let i = 0; i < points.length; i++) {
      const point = points[i] as PickupPointLocation;
      const distanceKm = haversineKm(lat, lon, point.latitude, point.longitude);
      distances[i] = distanceKm;
      if (distanceKm < nearestKm) nearestKm = distanceKm;
    }

    const radiusKm = RADIUS_TIERS_KM.find((radius) => nearestKm <= radius);
    const limitKm = radiusKm ?? Infinity;
    const candidates: number[] = [];
    for (let i = 0; i < points.length; i++) {
      if ((distances[i] as number) <= limitKm) candidates.push(i);
    }
    candidates.sort(
      (a, b) => (distances[a] as number) - (distances[b] as number),
    );
    const selected = candidates
      .slice(0, radiusKm === undefined ? FALLBACK_LIMIT : MAX_LOCATIONS)
      .map((i) => points[i] as PickupPointLocation);

    // Адреса ближайших — косметика для списка: если point/info лежит,
    // отдаём карту с координатами без адресов, и пикер покажет пункты с
    // «адрес уточняется», а не пустой экран
    let nearest: PickupPoint[] = [];
    let unavailable: string[] = [];
    try {
      ({ points: nearest, unavailable } = await getCachedPickupPointsInfo(
        selected.slice(0, NEAREST_WITH_DETAILS).map((p) => p.id),
      ));
    } catch (error) {
      console.warn(
        "[checkout/pickup-points] Ozon не отдал адреса ближайших пунктов:",
        error,
      );
    }
    const hidden = new Set(unavailable);

    const body: PickupPointsNearbyResponse = {
      locations: selected.filter((p) => !hidden.has(p.id)),
      nearest,
      expanded: radiusKm !== RADIUS_TIERS_KM[0],
    };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    console.error("[checkout/pickup-points] Ошибка:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить пункты выдачи" },
      { status: 502 },
    );
  }
}
