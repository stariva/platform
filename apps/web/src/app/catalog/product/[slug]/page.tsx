import { notFound, redirect } from "next/navigation";
import { getProductBySlug } from "@/lib/ozon-service";

interface ProductRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductRedirectPage({
  params,
}: ProductRedirectProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  redirect(`/catalog/${product.category}/${slug}`);
}
