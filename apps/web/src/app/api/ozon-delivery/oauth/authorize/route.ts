import { NextResponse } from "next/server";
import { env } from "@/env";

export const runtime = "nodejs";

/**
 * Служебный роут для одноразовой настройки OAuth Ozon Доставки.
 * Открой его в браузере под своей учёткой продавца — редиректнёт на
 * страницу авторизации Ozon. После подтверждения продавцом Ozon вернёт
 * code на /api/ozon-delivery/oauth/callback, который обменяет его на
 * refresh_token.
 */
export async function GET() {
  if (!env.OZON_DELIVERY_CLIENT_ID || !env.OZON_DELIVERY_REDIRECT_URI) {
    return NextResponse.json(
      {
        error:
          "Задайте OZON_DELIVERY_CLIENT_ID и OZON_DELIVERY_REDIRECT_URI в .env",
      },
      { status: 500 },
    );
  }

  const scope = [
    "seller-api.ozon-logistics",
    "seller-api.posting-fbo",
    "seller-api.posting-fbs",
    "seller-api.returns",
    "seller-api.report",
    "seller-api.product",
  ].join(" ");

  const url = new URL("https://seller.ozon.ru/app/appstore/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_company");
  url.searchParams.set("client_id", env.OZON_DELIVERY_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.OZON_DELIVERY_REDIRECT_URI);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", crypto.randomUUID());

  return NextResponse.redirect(url);
}
