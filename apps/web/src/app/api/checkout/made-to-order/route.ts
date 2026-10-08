import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
import { notifyMadeToOrderRequested } from "@/lib/commerce/order-notifications";
import { createMadeToOrderOrder } from "@/lib/commerce/orders";
import { unavailableItemsResponse } from "@/lib/commerce/unavailable-items";

export const runtime = "nodejs";

const bodySchema = z.object({
  contactName: z.string().trim().min(1).max(120),
  contactPhone: z.string().trim().min(5).max(32),
  contactEmail: z.string().trim().email().optional(),
  customerNotes: z.string().trim().max(1500).optional(),
  deliveryNote: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        productSlug: z.string().min(1),
        quantity: z.number().int().positive().max(MAX_MADE_TO_ORDER_QUANTITY),
        // Мерки и комментарий покупатель добавляет на странице заказа.
        options: madeToOrderOptionsSchema.pick({ size: true, color: true }),
      }),
    )
    .min(1)
    .max(MAX_MADE_TO_ORDER_LINES),
  // Отдельное согласие на обработку ПДн (ст. 9 152-ФЗ). Оферту покупатель
  // принимает позже — при предоплате, когда мастер согласовал итоговую цену.
  personalDataConsent: z.literal(true),
});

/**
 * Заявка на изделия под заказ, без оплаты: мастер связывается с покупателем,
 * согласует цену, мерки и доставку и выставляет предоплату в админке.
 * Цены из каталога — стартовые; Ozon Доставка не участвует.
 */
export async function POST(request: NextRequest) {
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
    console.error("[checkout/made-to-order] Ошибка проверки заявки:", error);
    return NextResponse.json(
      { error: "Не удалось проверить заявку" },
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
    deliveryNote: data.deliveryNote,
    items,
  });

  await notifyMadeToOrderRequested(order.id);

  return NextResponse.json({
    orderId: order.id,
    // Предварительная сумма по каталогу — для цели в аналитике, не для покупки
    estimate: order.amountTotal / 100,
  });
}
