import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { baseEnv, env } from "@/env";
import { getSession } from "@/lib/auth/session";
import { resolveCatalogItems } from "@/lib/commerce/catalog";
import { attachPaymentId, createProductOrder } from "@/lib/commerce/orders";
import { notifySellerAboutManualOrder } from "@/lib/notify/seller-order";
import { checkout, isOzonDeliveryConfigured } from "@/lib/ozon-delivery/client";
import { createPayment, isYooKassaConfigured } from "@/lib/payments/yookassa";

export const runtime = "nodejs";

const deliverySchema = z.object({
  method: z.literal("pickup"),
  pointId: z.string().min(1),
});

const bodySchema = z.object({
  contactName: z.string().min(1).max(120),
  contactPhone: z.string().min(5).max(20),
  contactEmail: z.string().email().optional(),
  items: z
    .array(
      z.object({
        productSlug: z.string().min(1),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .min(1)
    .max(100),
  delivery: deliverySchema,
  // seller_link — заказ без online-оплаты: продавец сам присылает покупателю
  // ссылку на оплату и подтверждает её. По умолчанию — обычная оплата ЮKassa.
  paymentMethod: z.enum(["yookassa", "seller_link"]).default("yookassa"),
});

function siteUrl(request: NextRequest): string {
  return (
    env.NEXT_PUBLIC_SITE_URL ??
    baseEnv.APP_URL ??
    request.nextUrl.origin
  ).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const data = parsed.data;

  if (!isOzonDeliveryConfigured()) {
    return NextResponse.json(
      { error: "Приём заказов временно недоступен" },
      { status: 503 },
    );
  }
  if (data.paymentMethod === "yookassa" && !isYooKassaConfigured()) {
    return NextResponse.json(
      { error: "Приём платежей временно недоступен" },
      { status: 503 },
    );
  }

  let items: Awaited<ReturnType<typeof resolveCatalogItems>>;
  let deliveryQuote: Awaited<ReturnType<typeof checkout>>;
  try {
    items = await resolveCatalogItems(data.items);
    deliveryQuote = await checkout({
      items: items.map((item) => ({
        sku: item.ozonSku,
        quantity: item.quantity,
      })),
      delivery: data.delivery,
      buyerPhone: data.contactPhone,
    });
  } catch (error) {
    console.error("[checkout/create] Ошибка проверки заказа:", error);
    return NextResponse.json(
      { error: "Не удалось проверить товары и доставку" },
      { status: 502 },
    );
  }

  if (!deliveryQuote.available) {
    return NextResponse.json(
      { error: "Доставка по выбранному адресу недоступна" },
      { status: 400 },
    );
  }

  const session = await getSession();

  const order = await createProductOrder({
    userId: session?.user.id,
    contactName: data.contactName,
    contactPhone: data.contactPhone,
    contactEmail: data.contactEmail,
    items,
    delivery: data.delivery,
    checkout: deliveryQuote,
    paymentMethod: data.paymentMethod,
  });

  if (data.paymentMethod === "seller_link") {
    if (order.confirmToken) {
      const confirmUrl = `${siteUrl(request)}/api/orders/${order.id}/confirm-payment?token=${order.confirmToken}`;
      await notifySellerAboutManualOrder({
        orderId: order.id,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        amountTotal: order.amountTotal,
        items,
        confirmUrl,
      }).catch((error) => {
        console.error(
          "[checkout/create] Не удалось уведомить продавца о заказе:",
          error,
        );
      });
    }
    return NextResponse.json({ orderId: order.id, manualPayment: true });
  }

  try {
    const payment = await createPayment({
      amountKopecks: order.amountTotal,
      description: `Заказ Stariva №${order.id.slice(0, 8)}`,
      returnUrl: `${siteUrl(request)}/order/${order.id}?payment=success`,
      metadata: { orderId: order.id, kind: "product" },
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

    return NextResponse.json({ confirmationUrl, orderId: order.id });
  } catch (error) {
    console.error("[checkout/create] Ошибка создания платежа:", error);
    return NextResponse.json(
      { error: "Не удалось создать платёж. Попробуйте позже." },
      { status: 502 },
    );
  }
}
