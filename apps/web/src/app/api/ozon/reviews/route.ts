import { NextResponse } from "next/server";
import { z } from "zod";
import { getProducts, getReviews } from "@/lib/ozon-service";
import type { Review } from "@/lib/ozon-types";

export const revalidate = 14400; // 4 hours

const offerIdSchema = z.string().min(1).optional();

/** Returns published reviews, optionally filtered by offer ID. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedOfferId = offerIdSchema.safeParse(
    searchParams.get("offerId") ?? undefined,
  );
  if (!parsedOfferId.success) {
    return NextResponse.json(
      { error: "Некорректный offerId" },
      { status: 400 },
    );
  }

  const offerId = parsedOfferId.data;
  let reviews: Review[];
  if (offerId) {
    // Отзывы привязаны к нашим товарам — находим товар по артикулу Ozon
    const product = (await getProducts()).find(
      (p) => p.ozonOfferId === offerId,
    );
    reviews = product ? await getReviews({ productId: product.id }) : [];
  } else {
    reviews = await getReviews();
  }

  return NextResponse.json({ reviews, total: reviews.length });
}
