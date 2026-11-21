import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/visitor";
import {
  releaseActivationAttempt,
  reserveActivationAttempt,
} from "@/lib/workshops/activation-attempts";
import {
  activateBoostyOrders,
  requestBoostyActivation,
} from "@/lib/workshops/boosty-activation";
import { sendLoginEmail } from "@/lib/workshops/buyer";
import { notifyWorkshopBooked } from "@/lib/workshops/notifications";

export const runtime = "nodejs";

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

const unavailable = () =>
  NextResponse.json(
    {
      error: "Сервис временно недоступен. Попробуйте ещё раз через пару минут.",
    },
    { status: 503 },
  );

/**
 * Покупатель вернулся из закрытого поста Boosty и ввёл email, на который
 * оформлял заказ. Если pending-заказ с таким email есть, сразу открываем
 * доступ и отправляем письмо со ссылкой входа — без ручной сверки.
 *
 * Лимит попыток по IP не даёт перебирать чужие адреса. Ответ одинаков для
 * найденного, уже активированного и неизвестного email: публичный маршрут не
 * должен раскрывать, есть ли заказ на этот адрес.
 */
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Укажите корректный email" },
      { status: 400 },
    );
  }

  const ip = clientIp(request.headers) ?? "unknown";
  let attemptId: string | null;
  try {
    attemptId = await reserveActivationAttempt(ip, "boosty");
  } catch (error) {
    // Сбой хранилища нельзя выдавать за исчерпанный лимит: иначе покупатель
    // будет час ждать, хотя повторить запрос можно сразу.
    console.error("[boosty/activate] Не удалось проверить лимит:", error);
    return unavailable();
  }
  if (!attemptId) {
    return NextResponse.json(
      {
        error:
          "Слишком много попыток активации. Попробуйте через час или напишите Ольге в чат заказа.",
      },
      { status: 429 },
    );
  }

  let result: Awaited<ReturnType<typeof activateBoostyOrders>>;
  try {
    result = await activateBoostyOrders(parsed.data.email);
  } catch (error) {
    // Ручной резерв: админ увидит заявку и сверит оплату в Boosty
    console.error("[boosty/activate] Автоактивация не удалась:", error);
    try {
      await requestBoostyActivation(parsed.data.email);
    } catch (cause) {
      console.error("[boosty/activate] Не удалось создать заявку:", cause);
      return unavailable();
    }
    return NextResponse.json({ ok: true, queued: true });
  }

  if (result.activatedOrderIds.length > 0) {
    // Успешная активация не расходует лимит неудачных попыток
    await releaseActivationAttempt(attemptId);
    await Promise.all(
      result.activatedOrderIds.map((orderId) => notifyWorkshopBooked(orderId)),
    );
    console.info("[boosty/activate] Автоактивация по email", {
      orders: result.activatedOrderIds,
      ip,
    });
  } else if (result.paidOrderIds.length > 0) {
    // Доступ уже открыт: высылаем свежую ссылку входа, чтобы письмо можно было
    // получить повторно, даже если первое не дошло.
    await sendLoginEmail(parsed.data.email, "/account", request.headers).catch(
      (error) =>
        console.error("[boosty/activate] Не удалось отправить вход:", error),
    );
    console.info("[boosty/activate] Повторная ссылка входа", { ip });
  }

  return NextResponse.json({ ok: true });
}
