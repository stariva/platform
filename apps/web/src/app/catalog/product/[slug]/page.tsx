import { notFound, redirect } from "next/navigation";
import { getProductBySlug } from "@/lib/catalog/service";
import { productHref } from "@/lib/products";

interface ProductRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductRedirectPage({
  params,
}: ProductRedirectProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  redirect(productHref(product));
}
