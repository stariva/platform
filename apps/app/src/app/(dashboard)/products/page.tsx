import {
  Badge,
  buttonVariants,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import { PRODUCT_CATEGORIES, PRODUCT_STATUS_LABELS } from "@stariva/validators";
import Link from "next/link";
import { SiteHeader } from "~/components/layout";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

const statusVariant = {
  published: "default",
  draft: "secondary",
  archived: "outline",
} as const;

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
                <TableHead>Как купить</TableHead>
                <TableHead>Статус</TableHead>
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
                      {product.image ? (
                        // biome-ignore lint/performance/noImgElement: превью из внешнего бакета без оптимизации
                        <img
                          src={product.image}
                          alt=""
                          className="size-10 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="bg-muted size-10 rounded" />
                      )}
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
                    <TableCell className="text-right tabular-nums">
                      {rub.format(product.price)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {product.stockAvailable > 0 && (
                          <Badge variant="default">
                            В наличии: {product.stockAvailable}
                          </Badge>
                        )}
                        {product.madeToOrder && (
                          <Badge variant="secondary">Под заказ</Badge>
                        )}
                        {product.stockAvailable === 0 &&
                          !product.madeToOrder && (
                            <Badge variant="outline">Нет в наличии</Badge>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[product.status]}>
                        {PRODUCT_STATUS_LABELS[product.status]}
                      </Badge>
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
