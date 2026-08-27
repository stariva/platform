import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/env";

export const runtime = "nodejs";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  scope: z.array(z.string()).optional(),
});

/**
 * Принимает code от Ozon после того, как продавец подтвердил доступ на
 * странице авторизации (см. /api/ozon-delivery/oauth/authorize), и меняет
 * его на refresh_token. Значение нужно один раз скопировать в
 * OZON_DELIVERY_REFRESH_TOKEN — дальше access_token обновляется сам.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Отсутствует code" }, { status: 400 });
  }
  if (
    !env.OZON_DELIVERY_CLIENT_ID ||
    !env.OZON_DELIVERY_CLIENT_SECRET ||
    !env.OZON_DELIVERY_REDIRECT_URI
  ) {
    return NextResponse.json(
      { error: "OZON_DELIVERY_CLIENT_ID / CLIENT_SECRET / REDIRECT_URI не заданы" },
      { status: 500 },
    );
  }

  const res = await fetch("https://xapi.ozon.ru/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: env.OZON_DELIVERY_CLIENT_ID,
      client_secret: env.OZON_DELIVERY_CLIENT_SECRET,
      redirect_uri: env.OZON_DELIVERY_REDIRECT_URI,
      code,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Ozon вернул ошибку ${res.status}`, detail },
      { status: 502 },
    );
  }

  const data = tokenResponseSchema.parse(await res.json());
  return NextResponse.json({
    message:
      "Скопируйте refresh_token в OZON_DELIVERY_REFRESH_TOKEN и перезапустите приложение. Больше эта страница не понадобится.",
    refresh_token: data.refresh_token,
    scope: data.scope,
  });
}
