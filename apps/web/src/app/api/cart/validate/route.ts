import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { CartValidationLine } from "@/lib/cart/validation";
import {
  isCatalogProductBuyable,
  MAX_ITEM_QUANTITY,
  priceInKopecks,
} from "@/lib/commerce/catalog";
import { getProductsResult } from "@/lib/ozon-service";

export const runtime = "nodejs";

const bodySchema = z.object({
  slugs: z.array(z.string().min(1).max(256)).min(1).max(100),
});

/**
 * Актуальные цена и остаток для товаров из корзины. Данные публичные (те же,
 * что в каталоге), поэтому без авторизации. Заказ всё равно пересчитывается на
 * сервере — это подсказка для корзины, а не гарантия.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const { products, status } = await getProductsResult();
  if (status === "unavailable") {
    return NextResponse.json(
      { error: "Каталог временно недоступен" },
      { status: 503 },
    );
  }

  const productsBySlug = new Map(products.map((p) => [p.slug, p]));
  const lines: CartValidationLine[] = [...new Set(parsed.data.slugs)].map(
    (productSlug) => {
      const product = productsBySlug.get(productSlug);
      if (!product) {
        return { productSlug, available: false, reason: "missing" };
      }
      const price = priceInKopecks(product);
      if (!isCatalogProductBuyable(product) || price === null) {
        return { productSlug, available: false, reason: "sold_out" };
      }
      return {
        productSlug,
        available: true,
        name: product.name,
        image: product.images[0] ?? "",
        ozonSku: product.ozonSku as number,
        price,
        maxQuantity: Math.min(MAX_ITEM_QUANTITY, product.stockAvailable),
      };
    },
  );

  return NextResponse.json(
    { lines },
    { headers: { "Cache-Control": "no-store" } },
  );
}
