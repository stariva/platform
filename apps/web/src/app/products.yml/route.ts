import { getProducts } from "@/lib/ozon-service";
import { productFeed } from "@/lib/product-feed";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await getProducts();
  // Do not advertise an empty catalogue when its upstream source is unavailable.
  if (!products.length)
    return new Response("Catalogue temporarily unavailable", {
      status: 503,
      headers: { "Retry-After": "3600" },
    });
  return new Response(productFeed(products), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
