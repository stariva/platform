import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { baseEnv, env } from "@/env";
import { getSession } from "@/lib/auth/session";
import { attachPaymentId, createProductOrder } from "@/lib/commerce/orders";
import type { DeliveryCheckoutResponse } from "@/lib/ozon-delivery/types";
import { createPayment, isYooKassaConfigured } from "@/lib/payments/yookassa";

export const runtime = "nodejs";

const deliverySchema = z.union([
  z.object({ method: z.literal("pickup"), pointId: z.string().min(1) }),
  z.object({
    method: z.literal("courier"),
    address: z.string().min(3),
    latitude: z.number(),
    longitude: z.number(),
  }),
]);

const bodySchema = z.object({
  contactName: z.string().min(1).max(120),
  contactPhone: z.string().min(5).max(20),
  contactEmail: z.string().email().optional(),
  items: z
    .array(
      z.object({
        productSlug: z.string().min(1),
        ozonSku: z.number().int().positive(),
        name: z.string().min(1),
        price: z.number().int().positive(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  delivery: deliverySchema,
  // Снапшот ответа /api/checkout/quote — воспроизводим его при создании
  // заказа в Ozon, состав нельзя изменить после checkout.
  checkout: z.object({
    available: z.boolean(),
    reason: z.string().optional(),
    deliveryPriceKopecks: z.number().int().nonnegative(),
    splits: z.array(z.unknown()),
  }),
});

function siteUrl(request: NextRequest): string {
  return (
    env.NEXT_PUBLIC_SITE_URL ??
    baseEnv.APP_URL ??
    request.nextUrl.origin
  ).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
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
  const data = parsed.data;

  if (!data.checkout.available) {
    return NextResponse.json(
      { error: "Доставка по выбранному адресу недоступна" },
      { status: 400 },
    );
  }

  const session = await getSession();

  const orderId = await createProductOrder({
    userId: session?.user.id,
    contactName: data.contactName,
    contactPhone: data.contactPhone,
    contactEmail: data.contactEmail,
    items: data.items,
    delivery: data.delivery,
    checkout: data.checkout as DeliveryCheckoutResponse,
  });

  const amountKopecks =
    data.items.reduce((sum, i) => sum + i.price * i.quantity, 0) +
    data.checkout.deliveryPriceKopecks;

  try {
    const payment = await createPayment({
      amountKopecks,
      description: `Заказ Stariva №${orderId.slice(0, 8)}`,
      returnUrl: `${siteUrl(request)}/order/${orderId}?payment=success`,
      metadata: { orderId, kind: "product" },
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
    console.error("[checkout/create] Ошибка создания платежа:", error);
    return NextResponse.json(
      { error: "Не удалось создать платёж. Попробуйте позже." },
      { status: 502 },
    );
  }
}
