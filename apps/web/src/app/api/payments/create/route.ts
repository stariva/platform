import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { baseEnv, env } from "@/env";
import { hasAccess } from "@/lib/account/access";
import { getSession } from "@/lib/auth/session";
import { attachPaymentId, createOrder } from "@/lib/payments/orders";
import { createPayment, isYooKassaConfigured } from "@/lib/payments/yookassa";
import { getWorkshopBySlug, workshopPriceKopecks } from "@/lib/workshops-data";

export const runtime = "nodejs";

const bodySchema = z.object({
  slug: z.string().min(1),
});

function siteUrl(request: NextRequest): string {
  return (
    env.NEXT_PUBLIC_SITE_URL ??
    baseEnv.APP_URL ??
    request.nextUrl.origin
  ).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  if (!isYooKassaConfigured()) {
    return NextResponse.json(
      { error: "Приём платежей временно недоступен" },
      { status: 503 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const workshop = getWorkshopBySlug(parsed.data.slug);
  if (!workshop) {
    return NextResponse.json(
      { error: "Мастер-класс не найден" },
      { status: 404 },
    );
  }

  const userId = session.user.id;

  // Уже куплен — повторная оплата не нужна
  if (await hasAccess(userId, workshop.slug)) {
    return NextResponse.json(
      { error: "У вас уже есть доступ к этому курсу", alreadyOwned: true },
      { status: 409 },
    );
  }

  const amountKopecks = workshopPriceKopecks(workshop);
  const orderId = await createOrder({
    userId,
    workshopSlug: workshop.slug,
    amountKopecks,
  });

  try {
    const payment = await createPayment({
      amountKopecks,
      description: `Мастер-класс «${workshop.title}» — Stariva`,
      returnUrl: `${siteUrl(request)}/account/workshops/${workshop.slug}?payment=success`,
      metadata: {
        orderId,
        userId,
        slug: workshop.slug,
      },
      // Идемпотентность по заказу — повторный клик не создаст второй платёж
      idempotenceKey: orderId,
    });

    await attachPaymentId(orderId, payment.id);

    const confirmationUrl = payment.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      return NextResponse.json(
        { error: "Не удалось получить ссылку на оплату" },
        { status: 502 },
      );
    }

    return NextResponse.json({ confirmationUrl, orderId });
  } catch (error) {
    console.error("[payments/create] Ошибка создания платежа:", error);
    return NextResponse.json(
      { error: "Не удалось создать платёж. Попробуйте позже." },
      { status: 502 },
    );
  }
}
