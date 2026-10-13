import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  isPaymentOverdue,
  madeToOrderPaymentStep,
} from "@/lib/commerce/made-to-order-flow";
import {
  type MeasurementField,
  measurementFieldsBySlug,
} from "@/lib/commerce/measurement-fields";
import {
  getProductCoverImages,
  getProductOrderById,
  getProductOrderItems,
} from "@/lib/commerce/orders";
import { getPostingStatuses } from "@/lib/ozon-delivery/postings";
import { phonesMatch } from "@/lib/phone";

export const runtime = "nodejs";

const bodySchema = z.object({ phone: z.string().min(5).max(32) });

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
  const covers = await getProductCoverImages(items.map((i) => i.productSlug));

  const postings = await getPostingStatuses(order.ozonPostingNumbers);

  const madeToOrder = order.kind === "made_to_order";
  const fields = madeToOrder
    ? await measurementFieldsBySlug(items.map((item) => item.productSlug))
    : new Map<string, MeasurementField[]>();

  return NextResponse.json({
    number: order.number,
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
      image: covers.get(i.productSlug) ?? null,
      options: i.options,
      measurementFields: fields.get(i.productSlug) ?? [],
    })),
    postings,
  });
}
