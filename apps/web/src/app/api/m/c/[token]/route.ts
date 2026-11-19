import { logger } from "@stariva/config";
import { NextResponse } from "next/server";
import { recordClick } from "@/lib/campaigns/tracking";
import { siteUrl } from "@/lib/workshops/notifications";

export const runtime = "nodejs";

/**
 * Кнопка или другая ссылка письма рассылки (?link=<имя в шаблоне>):
 * засчитываем переход и отправляем по адресу из рассылки — сам адрес в ссылке
 * не передаётся, подменить его нельзя. Чужой токен, неизвестная ссылка или
 * сбой базы — на главную сайта.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  let target: string | null = null;
  try {
    const link = new URL(request.url).searchParams.get("link");
    target = await recordClick(token, link);
  } catch (error) {
    logger.error("email_campaign.click_failed", error);
  }
  return NextResponse.redirect(target ?? siteUrl(), 302);
}
