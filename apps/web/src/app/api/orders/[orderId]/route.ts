import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  isPaymentOverdue,
  madeToOrderPaymentStep,
} from "@/lib/commerce/made-to-order-flow";
import {
  getProductOrderById,
  getProductOrderItems,
} from "@/lib/commerce/orders";
import { getMadeToOrder } from "@/lib/made-to-order";
import { getFbsPosting } from "@/lib/ozon-delivery/client";
import { getProductsResult } from "@/lib/ozon-service";
import { phonesMatch } from "@/lib/phone";

export const runtime = "nodejs";

const bodySchema = z.object({ phone: z.string().min(5).max(32) });

interface MeasurementField {
  id: string;
  label: string;
  hint: string;
}

/** Мерки, о которых мастер спрашивает по изделию: по категории из каталога, если изделие ещё в нём есть. */
async function measurementFieldsBySlug(
  slugs: string[],
): Promise<Map<string, MeasurementField[]>> {
  const bySlug = new Map<string, MeasurementField[]>();
  try {
    const { products } = await getProductsResult();
    for (const product of products) {
      if (slugs.includes(product.slug)) {
        bySlug.set(
          product.slug,
          getMadeToOrder(product.category)?.measurements ?? [],
        );
      }
    }
  } catch {
    // Каталог недоступен — покупатель опишет размер в комментарии
  }
  return bySlug;
}

/**
 * Гостевой просмотр заказа: подтверждение по телефону вместо аккаунта —
 * чтобы нельзя было подобрать чужой заказ, зная только id.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Укажите телефон" }, { status: 400 });
  }

  const order = await getProductOrderById(orderId);
  if (!order || !phonesMatch(order.contactPhone, parsed.data.phone)) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  const items = await getProductOrderItems(orderId);

  let postings: { postingNumber: string; status: string }[] = [];
  if (order.ozonPostingNumbers && order.ozonPostingNumbers.length > 0) {
    postings = await Promise.all(
      order.ozonPostingNumbers.map(async (number) => {
        try {
          const posting = await getFbsPosting(number);
          return { postingNumber: number, status: posting.status };
        } catch {
          return { postingNumber: number, status: "unknown" };
        }
      }),
    );
  }

  const madeToOrder = order.kind === "made_to_order";
  const fields = madeToOrder
    ? await measurementFieldsBySlug(items.map((item) => item.productSlug))
    : new Map<string, MeasurementField[]>();

  return NextResponse.json({
    kind: order.kind,
    status: order.status,
    paid: Boolean(order.paidAt),
    amountTotal: order.amountTotal,
    amountProducts: order.amountProducts,
    amountDelivery: order.amountDelivery,
    // Под заказ: условия, согласованные мастером, и что оплачивать сейчас
    depositAmount: order.depositAmount,
    depositPaid: Boolean(order.depositPaidAt),
    leadTime: order.leadTime,
    paymentDueAt: order.paymentDueAt,
    paymentOverdue: isPaymentOverdue(order),
    paymentStep: madeToOrderPaymentStep(order),
    declineReason: order.declineReason,
    createdAt: order.createdAt,
    deliveryMethod: order.deliveryMethod,
    customerNotes: order.customerNotes,
    deliveryNote: order.deliveryNote,
    trackingNumber: order.trackingNumber,
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      options: i.options,
      measurementFields: fields.get(i.productSlug) ?? [],
    })),
    postings,
  });
}
