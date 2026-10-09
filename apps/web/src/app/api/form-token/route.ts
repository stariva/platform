import { NextResponse } from "next/server";
import { issueFormToken } from "@/lib/auth/antispam";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Токен для форм регистрации и входа по ссылке (см. antispam-plugin). Форма
 * запрашивает его при открытии страницы; сервер по возрасту токена отличает
 * человека от скрипта, который шлёт запрос в API, не открывая страницу.
 */
export async function GET() {
  const { secret } = await auth.$context;
  return NextResponse.json(
    { token: issueFormToken(secret) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
