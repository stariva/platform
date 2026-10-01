import { SiteHeader } from "~/components/layout";
import { EMPTY_PRODUCT, ProductForm } from "~/components/products/product-form";
import { baseEnv } from "~/env";

export default function NewProductPage() {
  return (
    <>
      <SiteHeader title="Новый товар" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Новый товар</h1>
        <ProductForm
          initialValues={EMPTY_PRODUCT}
          storefrontUrl={baseEnv.STOREFRONT_URL}
        />
      </div>
    </>
  );
}
