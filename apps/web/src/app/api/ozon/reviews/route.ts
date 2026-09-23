import { NextResponse } from "next/server";
import { getReviews } from "@/lib/ozon-service";

export const revalidate = 14400; // 4 hours

/** Returns Ozon reviews, optionally filtered by offer ID and product SKUs. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const skusParam = searchParams.get("skus");
  const skus = skusParam
    ? skusParam.split(",").map(Number).filter(Boolean)
    : undefined;

  const offerId = searchParams.get("offerId") ?? undefined;

  const reviews = await getReviews({ offerId, skus });

  return NextResponse.json({ reviews, total: reviews.length });
}
