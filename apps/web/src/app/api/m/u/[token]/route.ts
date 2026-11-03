import { logger } from "@stariva/config";
import { NextResponse } from "next/server";
import { unsubscribe } from "@/lib/campaigns/tracking";
import { siteUrl } from "@/lib/workshops/notifications";

export const runtime = "nodejs";

/**
 * Отписка от рассылок. Сюда приходят двое: почтовик с отпиской в один клик
 * (RFC 8058, тело List-Unsubscribe=One-Click) — ему хватит 200, и форма со
 * страницы /unsubscribe — её возвращаем на ту же страницу с итогом.
 *
 * Только POST: GET по ссылкам письма делают и антивирусы, и превью почтовиков.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const form = await request.formData().catch(() => null);
  let done: boolean | "error";
  try {
    done = await unsubscribe(token);
  } catch (error) {
    logger.error("email_campaign.unsubscribe_failed", error);
    done = "error";
  }

  if (form?.get("List-Unsubscribe") === "One-Click") {
    // На 5xx почтовик повторит запрос сам
    const status = done === "error" ? 503 : done ? 200 : 404;
    return new Response(null, { status });
  }
  const page = new URL(`/unsubscribe/${encodeURIComponent(token)}`, siteUrl());
  if (done === "error") page.searchParams.set("error", "1");
  else if (done) page.searchParams.set("done", "1");
  return NextResponse.redirect(page, 303);
}
