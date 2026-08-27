import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/env";

export const runtime = "nodejs";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.coerce.number().int().positive(),
  scope: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => (Array.isArray(value) ? value.join(" ") : value)),
});

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

/**
 * Принимает code от Ozon после того, как продавец подтвердил доступ на
 * странице авторизации (см. /api/ozon-delivery/oauth/authorize), и меняет
 * его на refresh_token. Значение нужно один раз скопировать в
 * OZON_DELIVERY_REFRESH_TOKEN — дальше access_token обновляется сам.
 */
export async function GET(request: NextRequest) {
  const parsedQuery = callbackQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Отсутствует code или state" },
      { status: 400 },
    );
  }
  const { code, state } = parsedQuery.data;

  const expectedState = request.cookies.get("ozon_delivery_oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    return NextResponse.json({ error: "Неверный state" }, { status: 400 });
  }
  if (
    !env.OZON_DELIVERY_CLIENT_ID ||
    !env.OZON_DELIVERY_CLIENT_SECRET ||
    !env.OZON_DELIVERY_REDIRECT_URI
  ) {
    return NextResponse.json(
      {
        error:
          "OZON_DELIVERY_CLIENT_ID / CLIENT_SECRET / REDIRECT_URI не заданы",
      },
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

  const parsedToken = tokenResponseSchema.safeParse(await res.json());
  if (!parsedToken.success) {
    return NextResponse.json(
      {
        error: "Неожиданный формат ответа Ozon",
        detail: parsedToken.error.flatten(),
      },
      { status: 502 },
    );
  }
  const data = parsedToken.data;
  const response = NextResponse.json({
    message:
      "Скопируйте refresh_token в OZON_DELIVERY_REFRESH_TOKEN и перезапустите приложение. Больше эта страница не понадобится.",
    refresh_token: data.refresh_token,
    scope: data.scope,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  response.cookies.delete("ozon_delivery_oauth_state");
  return response;
}
