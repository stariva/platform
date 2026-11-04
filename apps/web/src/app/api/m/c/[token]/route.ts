import { logger } from "@stariva/config";
import { NextResponse } from "next/server";
import { recordClick } from "@/lib/campaigns/tracking";
import { siteUrl } from "@/lib/workshops/notifications";

export const runtime = "nodejs";

/**
 * Кнопка письма рассылки: засчитываем переход и отправляем по адресу кнопки
 * из рассылки — сам адрес в ссылке не передаётся, подменить его нельзя.
 * Чужой токен или сбой базы — на главную сайта.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  let target: string | null = null;
  try {
    target = await recordClick(token);
  } catch (error) {
    logger.error("email_campaign.click_failed", error);
  }
  return NextResponse.redirect(target ?? siteUrl(), 302);
}
