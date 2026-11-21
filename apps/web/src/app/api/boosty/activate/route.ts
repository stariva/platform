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
import { notifyWorkshopBooked } from "@/lib/workshops/notifications";

export const runtime = "nodejs";

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

/**
 * Покупатель вернулся из закрытого поста Boosty и ввёл email, на который
 * оформлял заказ. Если pending-заказ с таким email есть, сразу открываем
 * доступ и отправляем письмо со ссылкой входа — без ручной сверки.
 *
 * Лимит попыток по IP не даёт перебирать чужие адреса; сами заказы
 * подтверждает только точное совпадение email, поэтому доступ получает
 * владелец почты, а не автор запроса.
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
  const attemptId = await reserveActivationAttempt(ip, "boosty");
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
    await requestBoostyActivation(parsed.data.email).catch((cause) =>
      console.error("[boosty/activate] Не удалось создать заявку:", cause),
    );
    return NextResponse.json({
      ok: true,
      activated: 0,
      alreadyActive: false,
      queued: true,
    });
  }

  if (result.orderIds.length === 0) {
    return NextResponse.json({
      ok: true,
      activated: 0,
      alreadyActive: result.alreadyActive,
    });
  }

  // Успешная активация не расходует лимит неудачных попыток
  await releaseActivationAttempt(attemptId);
  await Promise.all(
    result.orderIds.map((orderId) => notifyWorkshopBooked(orderId)),
  );
  console.info("[boosty/activate] Автоактивация по email", {
    orders: result.orderIds,
    ip,
  });

  return NextResponse.json({
    ok: true,
    activated: result.orderIds.length,
    alreadyActive: false,
  });
}
