import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { grantAccess, hasAccess } from "@/lib/account/access";
import { getSession } from "@/lib/auth/session";
import { LEGAL_VERSION } from "@/lib/legal";
import { attachPaymentId, createOrder } from "@/lib/payments/orders";
import { createPayment, isYooKassaConfigured } from "@/lib/payments/yookassa";
import { findOrCreateBuyer, sendLoginEmail } from "@/lib/workshops/buyer";
import { siteUrl } from "@/lib/workshops/notifications";
import {
  WORKSHOP_ORDER_COOKIE,
  workshopOrderCookieValue,
} from "@/lib/workshops/order-cookie";
import { getWorkshopBySlug } from "@/lib/workshops/workshops-db";
import { workshopPriceKopecks } from "@/lib/workshops-data";

export const runtime = "nodejs";

/**
 * Гость платит без регистрации: email обязателен (на него придут доступ и
 * напоминания), как и отдельное согласие на обработку ПДн (ст. 9 152-ФЗ).
 * Вошедшему покупателю достаточно slug — email берём из аккаунта.
 */
const bodySchema = z.object({
  slug: z.string().min(1),
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  name: z.string().trim().max(120).optional(),
  personalDataConsent: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const input = parsed.data;

  const workshop = await getWorkshopBySlug(input.slug);
  if (!workshop) {
    return NextResponse.json(
      { error: "Мастер-класс не найден" },
      { status: 404 },
    );
  }

  const session = await getSession();
  let buyer: { id: string; email: string };
  if (session) {
    buyer = session.user;
  } else {
    if (!input.email) {
      return NextResponse.json(
        { error: "Укажите email — на него придёт доступ" },
        { status: 400 },
      );
    }
    if (input.personalDataConsent !== true) {
      return NextResponse.json(
        { error: "Нужно согласие на обработку персональных данных" },
        { status: 400 },
      );
    }
    buyer = await findOrCreateBuyer(input.email, input.name ?? "");
  }

  const coursePath = `/account/workshops/${workshop.slug}`;

  // Уже куплен — повторная оплата не нужна. Гостю шлём письмо со ссылкой
  // входа: он мог купить раньше и просто забыть, как войти.
  if (await hasAccess(buyer.id, workshop.slug)) {
    if (!session) {
      await sendLoginEmail(buyer.email, coursePath, request.headers).catch(
        (error) =>
          console.error("[payments/create] Не удалось отправить вход:", error),
      );
    }
    return NextResponse.json(
      {
        error: session
          ? "У вас уже есть доступ к этому курсу"
          : `Этот мастер-класс уже оплачен на ${buyer.email}. Мы отправили письмо со ссылкой для входа.`,
        alreadyOwned: true,
      },
      { status: 409 },
    );
  }

  const amountKopecks = workshopPriceKopecks(workshop);

  // Бесплатный мастер-класс — выдаём доступ сразу, без похода в ЮKassa
  if (amountKopecks === 0) {
    await grantAccess(buyer.id, workshop.slug);
    if (!session) {
      await sendLoginEmail(buyer.email, coursePath, request.headers).catch(
        (error) =>
          console.error("[payments/create] Не удалось отправить вход:", error),
      );
    }
    return NextResponse.json({ free: true, emailSent: !session });
  }

  if (!isYooKassaConfigured()) {
    return NextResponse.json(
      { error: "Приём платежей временно недоступен" },
      { status: 503 },
    );
  }

  const order = await createOrder({
    userId: buyer.id,
    workshopSlug: workshop.slug,
    amountKopecks,
    contactEmail: buyer.email,
  });

  try {
    const payment = await createPayment({
      amountKopecks,
      description: `Мастер-класс «${workshop.title}» — Stariva`,
      returnUrl: `${siteUrl()}/workshops/${workshop.slug}/booked?order=${order.id}`,
      metadata: {
        orderId: order.id,
        userId: buyer.id,
        slug: workshop.slug,
        // Фиксация согласия и акцепта: редакция документов на момент заказа
        offerAccepted: LEGAL_VERSION,
        ...(session ? {} : { pdConsent: LEGAL_VERSION }),
      },
      // Идемпотентность по заказу — повторный клик не создаст второй платёж
      idempotenceKey: order.id,
    });

    await attachPaymentId(order.id, payment.id);

    const confirmationUrl = payment.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      return NextResponse.json(
        { error: "Не удалось получить ссылку на оплату" },
        { status: 502 },
      );
    }

    const response = NextResponse.json({
      confirmationUrl,
      orderId: order.id,
    });
    // По этой cookie страница «Вы записаны» узнаёт браузер, оформивший
    // заказ, — гостю без входа не нужно ничего вводить повторно
    response.cookies.set(
      WORKSHOP_ORDER_COOKIE,
      workshopOrderCookieValue(order),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      },
    );
    return response;
  } catch (error) {
    console.error("[payments/create] Ошибка создания платежа:", error);
    return NextResponse.json(
      { error: "Не удалось создать платёж. Попробуйте позже." },
      { status: 502 },
    );
  }
}
