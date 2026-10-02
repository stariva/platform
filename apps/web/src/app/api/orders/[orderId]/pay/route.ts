import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { baseEnv, env } from "@/env";
import {
  isPaymentOverdue,
  madeToOrderPaymentStep,
} from "@/lib/commerce/made-to-order-flow";
import {
  attachOrderPaymentConfirmation,
  createOrderPayment,
  findReusableOrderPayment,
  getProductOrderById,
} from "@/lib/commerce/orders";
import { LEGAL_VERSION } from "@/lib/legal";
import { createPayment, isYooKassaConfigured } from "@/lib/payments/yookassa";
import { phonesMatch } from "@/lib/phone";

export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().min(5).max(32),
  // Оферту покупатель принимает при оплате — когда итоговая цена уже согласована.
  offerAccepted: z.literal(true),
});

const STAGE_DESCRIPTIONS = {
  deposit: "Предоплата",
  balance: "Доплата",
} as const;

function siteUrl(request: NextRequest): string {
  return (
    env.NEXT_PUBLIC_SITE_URL ??
    baseEnv.APP_URL ??
    request.nextUrl.origin
  ).replace(/\/$/, "");
}

/**
 * Оплата текущего этапа заказа под заказ: предоплата после одобрения мастером
 * или доплата после изготовления. Сумму берём из заказа, а не из запроса.
 * Как и просмотр заказа, подтверждается телефоном из заказа.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isYooKassaConfigured()) {
    return NextResponse.json(
      { error: "Приём платежей временно недоступен" },
      { status: 503 },
    );
  }

  const { orderId } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Подтвердите согласие с офертой" },
      { status: 400 },
    );
  }

  const order = await getProductOrderById(orderId);
  if (
    order?.kind !== "made_to_order" ||
    !phonesMatch(order.contactPhone, parsed.data.phone)
  ) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  const step = madeToOrderPaymentStep(order);
  if (!step) {
    return NextResponse.json(
      {
        error: isPaymentOverdue(order)
          ? "Срок оплаты истёк. Напишите мастеру — он продлит его."
          : "Сейчас по заказу нечего оплачивать. Обновите страницу.",
      },
      { status: 409 },
    );
  }

  const reusable = await findReusableOrderPayment(
    orderId,
    step.type,
    step.amount,
  );
  if (reusable?.confirmationUrl) {
    return NextResponse.json({ confirmationUrl: reusable.confirmationUrl });
  }

  const paymentRowId = await createOrderPayment(
    orderId,
    step.type,
    step.amount,
  );
  try {
    const payment = await createPayment({
      amountKopecks: step.amount,
      description: `${STAGE_DESCRIPTIONS[step.type]} по заказу Stariva №${orderId.slice(0, 8)}`,
      returnUrl: `${siteUrl(request)}/order/${orderId}?payment=success`,
      metadata: {
        orderId,
        kind: "product",
        orderPaymentId: paymentRowId,
        paymentType: step.type,
        // Фиксация акцепта оферты: редакция документов на момент оплаты.
        offerAccepted: LEGAL_VERSION,
      },
      idempotenceKey: paymentRowId,
    });

    const confirmationUrl = payment.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      return NextResponse.json(
        { error: "Не удалось получить ссылку на оплату" },
        { status: 502 },
      );
    }
    await attachOrderPaymentConfirmation(
      paymentRowId,
      payment.id,
      confirmationUrl,
    );
    return NextResponse.json({ confirmationUrl });
  } catch (error) {
    console.error(`[orders/pay] Ошибка создания платежа ${orderId}:`, error);
    return NextResponse.json(
      { error: "Не удалось создать платёж. Попробуйте позже." },
      { status: 502 },
    );
  }
}
