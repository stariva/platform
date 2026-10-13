import { buttonVariants } from "@stariva/ui";
import Link from "next/link";
import { z } from "zod";
import { SiteHeader } from "~/components/layout";
import { ProductsTable } from "~/components/products/products-table";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const priceDirSchema = z.enum(["asc", "desc"]);

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string | string[]; dir?: string | string[] }>;
}) {
  const { sort, dir } = await searchParams;
  const parsedDir = priceDirSchema.safeParse(Array.isArray(dir) ? dir[0] : dir);
  const priceSort =
    (Array.isArray(sort) ? sort[0] : sort) === "price" && parsedDir.success
      ? parsedDir.data
      : null;

  const products = await api.admin.products.list(
    priceSort ? { sort: "price", dir: priceSort } : undefined,
  );

  return (
    <>
      <SiteHeader title="Товары" />
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-10 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Товары</h1>
            <p className="text-muted-foreground text-sm">
              {products.length} в каталоге · на сайте{" "}
              {products.filter((p) => p.status === "published").length} ·
              готовых в наличии{" "}
              {products.filter((p) => p.stockAvailable > 0).length}
            </p>
          </div>
          <Link href="/products/new" className={buttonVariants()}>
            Добавить товар
          </Link>
        </div>

        <ProductsTable products={products} priceSort={priceSort} />
      </div>
    </>
  );
}
