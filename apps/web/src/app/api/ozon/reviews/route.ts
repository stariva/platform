import { NextResponse } from "next/server";
import { getReviews } from "@/lib/ozon-service";

export const revalidate = 14400; // 4 hours

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const skusParam = searchParams.get("skus");
  const skus = skusParam
    ? skusParam.split(",").map(Number).filter(Boolean)
    : undefined;

  const reviews = await getReviews(skus);

  return NextResponse.json({ reviews, total: reviews.length });
}
