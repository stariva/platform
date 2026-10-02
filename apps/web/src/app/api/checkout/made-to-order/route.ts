import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { baseEnv, env } from "@/env";
import { getSession } from "@/lib/auth/session";
import {
  CatalogItemsUnavailableError,
  MadeToOrderOptionsError,
  resolveMadeToOrderItems,
} from "@/lib/commerce/catalog";
import {
  MAX_MADE_TO_ORDER_LINES,
  MAX_MADE_TO_ORDER_QUANTITY,
  madeToOrderOptionsSchema,
} from "@/lib/commerce/made-to-order-options";
import { attachPaymentId, createMadeToOrderOrder } from "@/lib/commerce/orders";
import { unavailableItemsResponse } from "@/lib/commerce/unavailable-items";
import { LEGAL_VERSION } from "@/lib/legal";
import { createPayment, isYooKassaConfigured } from "@/lib/payments/yookassa";

export const runtime = "nodejs";

const bodySchema = z.object({
  contactName: z.string().trim().min(1).max(120),
  contactPhone: z.string().trim().min(5).max(32),
  contactEmail: z.string().trim().email().optional(),
  customerNotes: z.string().trim().max(1500).optional(),
  items: z
    .array(
      z.object({
        productSlug: z.string().min(1),
        quantity: z.number().int().positive().max(MAX_MADE_TO_ORDER_QUANTITY),
        // Мерки и комментарий покупатель добавляет после оплаты.
        options: madeToOrderOptionsSchema.pick({ size: true, color: true }),
      }),
    )
    .min(1)
    .max(MAX_MADE_TO_ORDER_LINES),
  // Отдельное согласие на обработку ПДн (ст. 9 152-ФЗ) и акцепт оферты.
  personalDataConsent: z.literal(true),
  offerAccepted: z.literal(true),
});

function siteUrl(request: NextRequest): string {
  return (
    env.NEXT_PUBLIC_SITE_URL ??
    baseEnv.APP_URL ??
    request.nextUrl.origin
  ).replace(/\/$/, "");
}

/**
 * Заказ изделий под заказ: цена из каталога, оплата 100% на сайте, детали
 * (мерки, цвет, доставка) покупатель и мастер уточняют уже после оплаты.
 * Ozon Доставка не участвует — отправляет мастер вручную.
 */
export async function POST(request: NextRequest) {
  if (!isYooKassaConfigured()) {
    return NextResponse.json(
      { error: "Приём платежей временно недоступен" },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const data = parsed.data;

  let items: Awaited<ReturnType<typeof resolveMadeToOrderItems>>;
  try {
    items = await resolveMadeToOrderItems(
      data.items.map((item) => ({
        productSlug: item.productSlug,
        quantity: item.quantity,
        options: { ...item.options, measurements: [] },
      })),
    );
  } catch (error) {
    if (error instanceof CatalogItemsUnavailableError) {
      return unavailableItemsResponse(
        error,
        "Некоторые изделия сняты с продажи — мы убрали их из корзины",
      );
    }
    if (error instanceof MadeToOrderOptionsError) {
      return NextResponse.json(
        { error: "Выбранный размер или цвет недоступен. Выберите заново." },
        { status: 400 },
      );
    }
    console.error("[checkout/made-to-order] Ошибка проверки заказа:", error);
    return NextResponse.json(
      { error: "Не удалось проверить заказ" },
      { status: 502 },
    );
  }

  const session = await getSession();
  const order = await createMadeToOrderOrder({
    userId: session?.user.id,
    contactName: data.contactName,
    contactPhone: data.contactPhone,
    contactEmail: data.contactEmail,
    customerNotes: data.customerNotes,
    items,
  });

  try {
    const payment = await createPayment({
      amountKopecks: order.amountTotal,
      description: `Заказ под заказ Stariva №${order.id.slice(0, 8)}`,
      returnUrl: `${siteUrl(request)}/order/${order.id}?payment=success`,
      metadata: {
        orderId: order.id,
        kind: "product",
        // Фиксация согласия и акцепта: редакция документов на момент заказа.
        pdConsent: LEGAL_VERSION,
        offerAccepted: LEGAL_VERSION,
      },
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

    return NextResponse.json({
      confirmationUrl,
      orderId: order.id,
      analytics: {
        id: order.id,
        revenue: order.amountTotal / 100,
        products: items.map((item) => ({
          id: item.productSlug,
          name: item.name,
          price: item.price / 100,
          quantity: item.quantity,
        })),
      },
    });
  } catch (error) {
    console.error("[checkout/made-to-order] Ошибка создания платежа:", error);
    return NextResponse.json(
      { error: "Не удалось создать платёж. Попробуйте позже." },
      { status: 502 },
    );
  }
}
