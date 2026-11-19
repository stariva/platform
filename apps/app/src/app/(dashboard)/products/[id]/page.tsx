import { notFound } from "next/navigation";
import { SiteHeader } from "~/components/layout";
import { ProductForm } from "~/components/products/product-form";
import { baseEnv } from "~/env";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, workshops] = await Promise.all([
    api.admin.products.byId({ id }).catch((error) => {
      if ((error as { code?: string }).code === "NOT_FOUND") notFound();
      throw error;
    }),
    api.admin.workshops.list(),
  ]);

  return (
    <>
      <SiteHeader title={product.values.name} />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {product.values.name}
        </h1>
        {/* key: после сохранения форма берёт свежие данные с сервера */}
        <ProductForm
          key={product.updatedAt.toISOString()}
          id={product.id}
          initialValues={product.values}
          ozon={product.ozon}
          storefrontUrl={baseEnv.STOREFRONT_URL}
          // Архивный остаётся в списке, если он уже привязан к товару
          workshops={workshops
            .filter(
              (w) =>
                w.status !== "archived" ||
                w.slug === product.values.workshopSlug,
            )
            .map(({ slug, title }) => ({ slug, title }))}
        />
      </div>
    </>
  );
}
