import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/env";
import { linkTelegramChat, unlinkTelegramChat } from "@/lib/payments/orders";
import {
  escapeTelegramHtml,
  sendClientMessage,
} from "@/lib/telegram/client-bot";
import { workshopCourseUrl } from "@/lib/workshops/notifications";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";
import { formatReleaseDateTime } from "@/lib/workshops-data";

export const runtime = "nodejs";

const updateSchema = z.object({
  message: z
    .object({
      chat: z.object({ id: z.number() }),
      text: z.string().optional(),
    })
    .optional(),
});

function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(secret);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Вебхук клиентского бота. Покупатель приходит по ссылке
 * t.me/<бот>?start=<telegramToken заказа> и подписывается на напоминания;
 * /stop отписывает. Telegram подписывает запросы секретом из setWebhook.
 */
export async function POST(request: NextRequest) {
  const secret = env.TELEGRAM_CLIENT_WEBHOOK_SECRET;
  if (!secret || !env.TELEGRAM_CLIENT_BOT_TOKEN) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (
    !authorized(request.headers.get("x-telegram-bot-api-secret-token"), secret)
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  const message = parsed.success ? parsed.data.message : undefined;
  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId = String(message.chat.id);
  const [command, payload] = message.text.trim().split(/\s+/, 2);

  try {
    if (command === "/start" && payload) {
      await handleStart(chatId, payload);
    } else if (command === "/stop") {
      const count = await unlinkTelegramChat(chatId);
      await sendClientMessage(
        chatId,
        count > 0
          ? "Напоминания отключены. Письма на email по-прежнему придут."
          : "Активных напоминаний нет.",
      );
    } else {
      await sendClientMessage(
        chatId,
        "Здравствуйте! Это бот Stariva: он напоминает о старте мастер-классов. Чтобы подписаться, нажмите «Напоминать в Telegram» на странице заказа или в письме о покупке. Отписаться — /stop.",
      );
    }
  } catch (error) {
    // Отвечаем 200: иначе Telegram будет повторять то же обновление
    console.error("[telegram/webhook] Ошибка обработки:", error);
  }
  return NextResponse.json({ ok: true });
}

async function handleStart(chatId: string, token: string) {
  const order = await linkTelegramChat(token, chatId);
  if (!order) {
    await sendClientMessage(
      chatId,
      "Не нашли такой заказ. Откройте ссылку «Напоминать в Telegram» из письма о покупке ещё раз.",
    );
    return;
  }

  const workshop = await getWorkshopBySlug(order.workshopSlug, "owned");
  const title = escapeTelegramHtml(`«${workshop?.title ?? "мастер-класс"}»`);
  const upcoming =
    workshop?.releaseAt && new Date(workshop.releaseAt) > new Date()
      ? formatReleaseDateTime(workshop.releaseAt)
      : null;
  await sendClientMessage(
    chatId,
    upcoming
      ? `Готово! Напомним о мастер-классе ${title} за неделю, за день и в момент старта — ${upcoming}.\n\nОтписаться — /stop.`
      : `Готово! Мастер-класс ${title} ждёт вас в личном кабинете.\n\nОтписаться — /stop.`,
    {
      text: "Открыть кабинет",
      url: workshopCourseUrl(order.workshopSlug),
    },
  );
}
