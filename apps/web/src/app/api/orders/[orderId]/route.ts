import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getProductOrderById,
  getProductOrderItems,
} from "@/lib/commerce/orders";
import { getFbsPosting } from "@/lib/ozon-delivery/client";

export const runtime = "nodejs";

const bodySchema = z.object({ phone: z.string().min(5).max(20) });

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
  if (!order || order.contactPhone !== parsed.data.phone) {
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

  return NextResponse.json({
    status: order.status,
    paymentMethod: order.paymentMethod,
    amountTotal: order.amountTotal,
    amountDelivery: order.amountDelivery,
    createdAt: order.createdAt,
    deliveryMethod: order.deliveryMethod,
    items: items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
    })),
    postings,
  });
}
