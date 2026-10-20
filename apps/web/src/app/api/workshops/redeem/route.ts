import { hasAccess, normalizeAccessCode } from "@stariva/web-api";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { clientIp, collectVisitor } from "@/lib/visitor";
import {
  findAccessCode,
  redeemAccessCode,
  releaseAccessCodeAttempt,
  reserveAccessCodeAttempt,
} from "@/lib/workshops/access-codes";
import { findOrCreateBuyer, sendLoginEmail } from "@/lib/workshops/buyer";
import { notifyWorkshopBooked } from "@/lib/workshops/notifications";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";

export const runtime = "nodejs";

const bodySchema = z.object({
  code: z.string().max(40),
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  personalDataConsent: z.boolean().optional(),
});

const error = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

/**
 * Активация кода с Ярмарки Мастеров (страница /code). Как гостевая покупка:
 * курс открываем на введённый email, а войти можно только по ссылке из
 * письма — иначе по чужому коду можно было бы зайти в чужой аккаунт.
 * Вошедшему достаточно кода: курс появится в его кабинете сразу.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error("Некорректный запрос", 400);
  const input = parsed.data;

  const code = normalizeAccessCode(input.code);
  if (!code) return error("В коде 6 цифр — проверьте, все ли на месте", 400);

  const session = await getSession();
  if (!session) {
    if (!input.email)
      return error("Укажите email — на него придёт доступ", 400);
    if (input.personalDataConsent !== true) {
      return error("Нужно согласие на обработку персональных данных", 400);
    }
  }

  const ip = clientIp(request.headers) ?? "unknown";
  const attemptId = await reserveAccessCodeAttempt(ip);
  if (!attemptId) {
    return error(
      "Слишком много неверных кодов. Попробуйте через час или напишите Ольге в чат заказа на Ярмарке.",
      429,
    );
  }

  const found = await findAccessCode(code);
  if (!found) {
    return error(
      "Такого кода нет. Сверьте цифры с сообщением Ольги на Ярмарке Мастеров.",
      404,
    );
  }
  if (found.redeemedAt) {
    return NextResponse.json(
      {
        error:
          "Этот код уже активирован. Если это были вы — войдите по ссылке из письма или через «Войти».",
        used: true,
      },
      { status: 409 },
    );
  }

  const workshop = await getWorkshopBySlug(found.workshopSlug, "owned");
  if (!workshop) {
    return error(
      "Мастер-класс по этому коду сейчас недоступен. Напишите Ольге в чат заказа.",
      404,
    );
  }

  const buyer = session
    ? session.user
    : await findOrCreateBuyer(input.email as string, "");
  const coursePath = `/account/workshops/${workshop.slug}`;

  const alreadyOwned = async () => {
    if (!session) {
      await sendLoginEmail(buyer.email, coursePath, request.headers).catch(
        (cause) =>
          console.error("[workshops/redeem] Не удалось отправить вход:", cause),
      );
    }
    return NextResponse.json(
      {
        error: session
          ? "Этот мастер-класс уже есть в вашем кабинете"
          : `Мастер-класс уже открыт для ${buyer.email}. Мы отправили на эту почту ссылку для входа.`,
        alreadyOwned: true,
        coursePath: session ? coursePath : undefined,
      },
      { status: 409 },
    );
  };

  // Курс уже открыт — код не тратим: пригодится, если ошиблись почтой
  if (await hasAccess(buyer.id, workshop.slug)) return alreadyOwned();

  let order: Awaited<ReturnType<typeof redeemAccessCode>>;
  try {
    order = await redeemAccessCode({
      code: found,
      userId: buyer.id,
      email: buyer.email,
      releaseAt: workshop.releaseAt ? new Date(workshop.releaseAt) : null,
      visitor: await collectVisitor(request),
    });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "course_already_owned") {
      return alreadyOwned();
    }
    throw cause;
  }
  if (!order) {
    return NextResponse.json(
      { error: "Этот код уже активирован.", used: true },
      { status: 409 },
    );
  }
  await releaseAccessCodeAttempt(attemptId);

  console.info(
    `[workshops/redeem] Код ${found.id} активирован, заказ ${order.id}, курс «${workshop.slug}»`,
  );
  // Письмо с личной ссылкой и PDF-брифом, уведомление мастеру
  await notifyWorkshopBooked(order.id);

  return NextResponse.json(
    session
      ? { ok: true, coursePath }
      : { ok: true, email: buyer.email, title: workshop.title },
  );
}
