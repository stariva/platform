import { NextResponse } from "next/server";
import { isOzonDeliveryConfigured } from "@/lib/ozon-delivery/auth";
import { getCachedPickupPointsInfo } from "@/lib/ozon-delivery/pickup-points-cache";
import type { PickupPointDetailsResponse } from "@/lib/ozon-delivery/types";

export const runtime = "nodejs";

const MAX_IDS = 50;

export async function GET(request: Request) {
  if (!isOzonDeliveryConfigured()) {
    return NextResponse.json(
      { error: "Доставка Ozon временно недоступна" },
      { status: 503 },
    );
  }

  const ids = [
    ...new Set(
      (new URL(request.url).searchParams.get("ids") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => /^\d{1,19}$/.test(id)),
    ),
  ];
  if (ids.length === 0 || ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: "Некорректный список пунктов" },
      { status: 400 },
    );
  }

  try {
    const body: PickupPointDetailsResponse =
      await getCachedPickupPointsInfo(ids);
    return NextResponse.json(body, {
      headers: { "Cache-Control": "private, max-age=600" },
    });
  } catch (error) {
    console.error("[checkout/pickup-points/details] Ошибка:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить данные пунктов выдачи" },
      { status: 502 },
    );
  }
}
