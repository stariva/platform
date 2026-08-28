import { logger } from "@stariva/config";
import { NextResponse } from "next/server";
import { env } from "@/env";
import type {
  OzonProductInfoResponse,
  OzonProductListResponse,
} from "@/lib/ozon-types";

const OZON_API_URL = "https://api-seller.ozon.ru";

async function fetchOzonProducts(): Promise<OzonProductInfoResponse | null> {
  const clientId = env.OZON_CLIENT_ID;
  const apiKey = env.OZON_API_KEY;

  if (!clientId || !apiKey) {
    return null;
  }

  try {
    // First, get product list
    const listResponse = await fetch(`${OZON_API_URL}/v2/product/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": clientId,
        "Api-Key": apiKey,
      },
      body: JSON.stringify({
        filter: {
          visibility: "ALL",
        },
        last_id: "",
        limit: 100,
      }),
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!listResponse.ok) {
      logger.warn("ozon.route.list_failed", { status: listResponse.status });
      return null;
    }

    const listData: OzonProductListResponse = await listResponse.json();
    const productIds = listData.result.items.map((item) => item.product_id);

    if (productIds.length === 0) {
      return { result: { items: [] } };
    }

    // Then, get detailed info
    const infoResponse = await fetch(`${OZON_API_URL}/v2/product/info/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": clientId,
        "Api-Key": apiKey,
      },
      body: JSON.stringify({
        product_id: productIds,
      }),
      next: { revalidate: 3600 },
    });

    if (!infoResponse.ok) {
      logger.warn("ozon.route.info_failed", { status: infoResponse.status });
      return null;
    }

    return await infoResponse.json();
  } catch (error) {
    logger.error("ozon.route.error", error);
    return null;
  }
}

export async function GET() {
  const data = await fetchOzonProducts();

  if (!data) {
    return NextResponse.json(
      { error: "Ozon API unavailable", fallback: true },
      { status: 503 },
    );
  }

  return NextResponse.json(data);
}
