import {
  buttonVariants,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import { PRODUCT_CATEGORIES } from "@stariva/validators";
import Link from "next/link";
import { SiteHeader } from "~/components/layout";
import { AvailabilitySwitches } from "~/components/products/availability-switches";
import { PriceCell } from "~/components/products/price-cell";
import { ProductThumb } from "~/components/products/product-thumb";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await api.admin.products.list();

  return (
    <>
      <SiteHeader title="Товары" />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
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

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14" />
                <TableHead>Название</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead className="text-right">Цена</TableHead>
                <TableHead>Продажа</TableHead>
                <TableHead className="text-right">Порядок</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const category = PRODUCT_CATEGORIES[product.category];
                const subcategories: Record<string, string> =
                  category.subcategories;
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <ProductThumb src={product.image} />
                    </TableCell>
                    <TableCell className="max-w-[360px]">
                      <Link
                        href={`/products/${product.id}`}
                        className="line-clamp-2 font-medium whitespace-normal hover:underline"
                      >
                        {product.name}
                      </Link>
                      <span className="text-muted-foreground text-xs">
                        {product.ozonOfferId ?? product.slug}
                        {product.featured && " · на главной"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {category.label}
                      <div className="text-muted-foreground text-xs">
                        {subcategories[product.subcategory]}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <PriceCell id={product.id} price={product.price} />
                    </TableCell>
                    <TableCell>
                      <AvailabilitySwitches
                        id={product.id}
                        name={product.name}
                        status={product.status}
                        madeToOrder={product.madeToOrder}
                        stockAvailable={product.stockAvailable}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {product.sortOrder}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
