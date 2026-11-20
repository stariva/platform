import { and, db, eq, isNull, like, orders, sql } from "@stariva/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const inputSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
});

/** Общая ссылка из закрытого поста создаёт заявку, но сама по себе не подтверждает оплату. */
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Укажите корректный email" },
      { status: 400 },
    );
  }
  await db
    .update(orders)
    .set({ boostyActivationRequestedAt: new Date() })
    .where(
      and(
        eq(sql`lower(${orders.contactEmail})`, parsed.data.email),
        eq(orders.status, "pending"),
        like(orders.paymentId, "boosty:%"),
        isNull(orders.boostyActivationRequestedAt),
      ),
    );
  return NextResponse.json({ ok: true });
}
