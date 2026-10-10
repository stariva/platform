"use client";

import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import {
  PRODUCT_CATEGORIES,
  type ProductCategoryId,
} from "@stariva/validators";
import Link from "next/link";
import { useState } from "react";
import { AvailabilitySwitches } from "./availability-switches";
import { PriceCell } from "./price-cell";
import { ProductThumb } from "./product-thumb";

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  category: ProductCategoryId;
  subcategory: string;
  status: "draft" | "published" | "archived";
  price: number;
  image: string | null;
  madeToOrder: boolean;
  stockAvailable: number;
  featured: boolean;
  sortOrder: number;
  ozonOfferId: string | null;
}

type StatusFilter = "all" | AdminProduct["status"];
type StockFilter = "all" | "inStock" | "outOfStock";
type OrderFilter = "all" | "madeToOrder" | "ready";
type CategoryFilter = "all" | ProductCategoryId;

interface Option<T extends string> {
  id: T;
  label: string;
  match: (product: AdminProduct) => boolean;
}

const STATUS_OPTIONS: Option<StatusFilter>[] = [
  { id: "all", label: "Все", match: () => true },
  {
    id: "published",
    label: "На сайте",
    match: (p) => p.status === "published",
  },
  { id: "draft", label: "Черновики", match: (p) => p.status === "draft" },
  { id: "archived", label: "Архив", match: (p) => p.status === "archived" },
];

const STOCK_OPTIONS: Option<StockFilter>[] = [
  { id: "all", label: "Все", match: () => true },
  { id: "inStock", label: "В наличии", match: (p) => p.stockAvailable > 0 },
  {
    id: "outOfStock",
    label: "Нет в наличии",
    match: (p) => p.stockAvailable === 0,
  },
];

const ORDER_OPTIONS: Option<OrderFilter>[] = [
  { id: "all", label: "Все", match: () => true },
  { id: "madeToOrder", label: "Под заказ", match: (p) => p.madeToOrder },
  { id: "ready", label: "Не под заказ", match: (p) => !p.madeToOrder },
];

const CATEGORY_OPTIONS: Option<CategoryFilter>[] = [
  { id: "all", label: "Все", match: () => true },
  ...(Object.keys(PRODUCT_CATEGORIES) as ProductCategoryId[]).map((id) => ({
    id,
    label: PRODUCT_CATEGORIES[id].label,
    match: (p: AdminProduct) => p.category === id,
  })),
];

/** Ряд кнопок-фильтров; в скобках — сколько товаров дадут при текущих остальных фильтрах. */
function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
  counts,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  counts: Record<T, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground w-24 shrink-0 text-sm">
        {label}
      </span>
      {options.map(({ id, label: optionLabel }) => (
        <Button
          key={id}
          size="sm"
          variant={value === id ? "default" : "outline"}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {optionLabel}
          <span className="tabular-nums opacity-60">{counts[id]}</span>
        </Button>
      ))}
    </div>
  );
}

/** Таблица товаров с поиском и фильтрами по статусу, наличию, «под заказ» и категории. */
export function ProductsTable({ products }: { products: AdminProduct[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [order, setOrder] = useState<OrderFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const needle = query.trim().toLowerCase();
  const matchesQuery = (p: AdminProduct) =>
    needle === "" ||
    p.name.toLowerCase().includes(needle) ||
    p.slug.toLowerCase().includes(needle) ||
    (p.ozonOfferId?.toLowerCase().includes(needle) ?? false);

  const selected = {
    status: STATUS_OPTIONS.find((o) => o.id === status),
    stock: STOCK_OPTIONS.find((o) => o.id === stock),
    order: ORDER_OPTIONS.find((o) => o.id === order),
    category: CATEGORY_OPTIONS.find((o) => o.id === category),
  };

  /** Фильтры, кроме одного: так счётчик на кнопке показывает, что получится после клика. */
  const matchesExcept = (
    p: AdminProduct,
    skip?: "status" | "stock" | "order" | "category",
  ) =>
    matchesQuery(p) &&
    (skip === "status" || (selected.status?.match(p) ?? true)) &&
    (skip === "stock" || (selected.stock?.match(p) ?? true)) &&
    (skip === "order" || (selected.order?.match(p) ?? true)) &&
    (skip === "category" || (selected.category?.match(p) ?? true));

  function countsFor<T extends string>(
    options: Option<T>[],
    skip: "status" | "stock" | "order" | "category",
  ) {
    const base = products.filter((p) => matchesExcept(p, skip));
    return Object.fromEntries(
      options.map((o) => [o.id, base.filter(o.match).length]),
    ) as Record<T, number>;
  }

  const filtersKey = JSON.stringify([query, status, stock, order, category]);
  const [visibleRows, setVisibleRows] = useState(() => ({
    filtersKey,
    ids: products.map((p) => p.id),
  }));

  // Keep row membership until the search or filters change.
  if (visibleRows.filtersKey !== filtersKey) {
    setVisibleRows({
      filtersKey,
      ids: products.filter((p) => matchesExcept(p)).map((p) => p.id),
    });
  }

  const productsById = new Map(products.map((p) => [p.id, p]));
  const visible = visibleRows.ids.flatMap((id) => {
    const product = productsById.get(id);
    return product ? [product] : [];
  });
  const filtersActive =
    needle !== "" ||
    status !== "all" ||
    stock !== "all" ||
    order !== "all" ||
    category !== "all";

  function reset() {
    setQuery("");
    setStatus("all");
    setStock("all");
    setOrder("all");
    setCategory("all");
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по названию или артикулу"
          aria-label="Поиск по товарам"
          className="max-w-sm"
        />
        <FilterRow
          label="Статус"
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          counts={countsFor(STATUS_OPTIONS, "status")}
        />
        <FilterRow
          label="Наличие"
          options={STOCK_OPTIONS}
          value={stock}
          onChange={setStock}
          counts={countsFor(STOCK_OPTIONS, "stock")}
        />
        <FilterRow
          label="Под заказ"
          options={ORDER_OPTIONS}
          value={order}
          onChange={setOrder}
          counts={countsFor(ORDER_OPTIONS, "order")}
        />
        <FilterRow
          label="Категория"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={setCategory}
          counts={countsFor(CATEGORY_OPTIONS, "category")}
        />
        <div className="text-muted-foreground flex items-center gap-3 text-sm">
          <span>
            Показано {visible.length} из {products.length}
          </span>
          {filtersActive && (
            <Button size="sm" variant="ghost" onClick={reset}>
              Сбросить фильтры
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24" />
              <TableHead>Название</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead className="text-right">Цена</TableHead>
              <TableHead>Продажа</TableHead>
              <TableHead className="text-right">Порядок</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-8 text-center"
                >
                  Ничего не найдено
                </TableCell>
              </TableRow>
            )}
            {visible.map((product) => {
              const productCategory = PRODUCT_CATEGORIES[product.category];
              const subcategories: Record<string, string> =
                productCategory.subcategories;
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
                    {productCategory.label}
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
  );
}
