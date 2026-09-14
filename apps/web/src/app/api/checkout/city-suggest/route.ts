import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/env";

export const runtime = "nodejs";

const DADATA_URL =
  "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address";

const dadataResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      value: z.string(),
      data: z.object({
        geo_lat: z.string().nullable().optional(),
        geo_lon: z.string().nullable().optional(),
      }),
    }),
  ),
});

export async function GET(request: Request) {
  const apiKey = env.DADATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Поиск города временно недоступен" },
      { status: 503 },
    );
  }

  const query = new URL(request.url).searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const res = await fetch(DADATA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        count: 10,
        from_bound: { value: "city" },
        to_bound: { value: "settlement" },
        locations: [{ country_iso_code: "RU" }],
      }),
    });

    if (!res.ok) {
      throw new Error(`dadata_request_failed_${res.status}`);
    }

    const data = dadataResponseSchema.parse(await res.json());
    const suggestions = data.suggestions
      .filter((s) => s.data.geo_lat && s.data.geo_lon)
      .map((s) => ({
        value: s.value,
        lat: Number(s.data.geo_lat),
        lon: Number(s.data.geo_lon),
      }));

    return NextResponse.json(
      { suggestions },
      { headers: { "Cache-Control": "private, max-age=3600" } },
    );
  } catch (error) {
    console.error("[checkout/city-suggest] Ошибка:", error);
    return NextResponse.json(
      { error: "Не удалось найти город" },
      { status: 502 },
    );
  }
}
