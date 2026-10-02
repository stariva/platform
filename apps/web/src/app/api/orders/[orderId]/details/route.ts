import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { measurementEntrySchema } from "@/lib/commerce/made-to-order-options";
import { notifyMadeToOrderDetailsUpdated } from "@/lib/commerce/order-notifications";
import {
  getProductOrderById,
  updateMadeToOrderDetails,
} from "@/lib/commerce/orders";
import { phonesMatch } from "@/lib/phone";

export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().min(5).max(32),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        measurements: z.array(measurementEntrySchema).max(10),
        comment: z.string().trim().max(1500).optional(),
      }),
    )
    .max(20),
  customerNotes: z.string().trim().max(1500).optional(),
  deliveryNote: z.string().trim().max(1000).optional(),
});

/**
 * Покупатель дополняет оплаченный заказ под заказ: мерки, пожелания и куда
 * отправить. Как и просмотр заказа, подтверждается телефоном из заказа.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Проверьте введённые данные" },
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

  const { phone: _phone, ...details } = parsed.data;
  const updated = await updateMadeToOrderDetails(orderId, details);
  if (!updated) {
    return NextResponse.json(
      {
        error:
          "Заказ уже нельзя дополнить на сайте. Напишите мастеру в Telegram.",
      },
      { status: 409 },
    );
  }

  await notifyMadeToOrderDetailsUpdated(orderId);
  return NextResponse.json({ ok: true });
}
