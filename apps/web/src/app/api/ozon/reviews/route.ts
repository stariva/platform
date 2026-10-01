import { NextResponse } from "next/server";
import { z } from "zod";
import { getReviews } from "@/lib/ozon-service";

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

  const reviews = await getReviews({ offerId: parsedOfferId.data });

  return NextResponse.json({ reviews, total: reviews.length });
}
