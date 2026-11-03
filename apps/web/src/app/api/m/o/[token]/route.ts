import { logger } from "@stariva/config";
import { recordOpen } from "@/lib/campaigns/tracking";

export const runtime = "nodejs";

// Прозрачная картинка 1×1
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

/**
 * Пиксель письма рассылки: почтовик подгрузил картинку — письмо открыли.
 * Цифра с запасом: Gmail, Яндекс, Mail.ru и Apple Mail подгружают картинки
 * сами. Картинку отдаём всегда, даже если засчитать не вышло.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    await recordOpen(token);
  } catch (error) {
    logger.error("email_campaign.open_failed", error);
  }
  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
