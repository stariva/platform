"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AddToCartButton } from "@/components/stariva/add-to-cart-button";
import { ProductCardImages } from "@/components/stariva/product-card-images";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProductMadeToOrder } from "@/lib/made-to-order";
import type { Product } from "@/lib/ozon-types";
import { formatPrice, productSectionKey } from "@/lib/products";

interface CategoryFiltersProps {
  products: Product[];
  /** Таблетки фильтра: подкатегории внутри категории или категории на общей витрине. */
  filters: { slug: string; name: string }[];
  /** section — разделы витрины: абажуры отдельно от остального декора. */
  filterBy?: "subcategory" | "category" | "section";
  /** Кнопка «В корзину» прямо в карточке — для витрины готовых изделий. */
  showAddToCart?: boolean;
}

function filterKey(
  product: Product,
  filterBy: NonNullable<CategoryFiltersProps["filterBy"]>,
): string {
  return filterBy === "section"
    ? productSectionKey(product)
    : product[filterBy];
}

/**
 * Фильтрует товары по категории или подкатегории и сортирует по цене.
 * По умолчанию использует подкатегории и скрывает кнопки добавления в корзину.
 */
export default function CategoryFilters({
  products,
  filters,
  filterBy = "subcategory",
  showAddToCart = false,
}: CategoryFiltersProps) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">(
    "default",
  );

  const filteredProducts = useMemo(() => {
    let result =
      activeFilter === "all"
        ? products
        : products.filter((p) => filterKey(p, filterBy) === activeFilter);

    if (sortBy === "price-asc")
      result = [...result].sort((a, b) => a.price - b.price);
    else if (sortBy === "price-desc")
      result = [...result].sort((a, b) => b.price - a.price);

    return result;
  }, [products, filterBy, activeFilter, sortBy]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const filter of filters) {
      counts[filter.slug] = products.filter(
        (p) => filterKey(p, filterBy) === filter.slug,
      ).length;
    }
    return counts;
  }, [products, filters, filterBy]);

  return (
    <>
      {/* ── Filters bar ── */}
      <section className="sticky top-[60px] lg:top-[68px] z-30 bg-parchment/96 backdrop-blur-sm border-b border-espresso/8">
        <div className="max-w-[1440px] mx-auto px-5 lg:px-12 py-4 flex items-center justify-between gap-4 flex-wrap">
          {/* Filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setActiveFilter("all")}
              variant={activeFilter === "all" ? "default" : "secondary"}
              size="sm"
              className={`rounded-full label-caps text-[11px] h-auto py-2 transition-all duration-200 ${
                activeFilter === "all"
                  ? "bg-espresso text-parchment hover:bg-espresso/90"
                  : "bg-sand text-espresso hover:bg-espresso/10"
              }`}
            >
              Все ({products.length})
            </Button>
            {filters.map((filter) => (
              <Button
                key={filter.slug}
                onClick={() => setActiveFilter(filter.slug)}
                variant={activeFilter === filter.slug ? "default" : "secondary"}
                size="sm"
                className={`rounded-full label-caps text-[11px] h-auto py-2 transition-all duration-200 ${
                  activeFilter === filter.slug
                    ? "bg-espresso text-parchment hover:bg-espresso/90"
                    : "bg-sand text-espresso hover:bg-espresso/10"
                }`}
              >
                {filter.name}
                {(filterCounts[filter.slug] ?? 0) > 0 && (
                  <span className="ml-1.5 opacity-50">
                    ({filterCounts[filter.slug]})
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Sort */}
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as typeof sortBy)}
          >
            <SelectTrigger className="rounded-full bg-sand text-espresso label-caps text-[11px] border-0 h-auto py-2 px-4 focus:ring-1 focus:ring-espresso/20 w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">По умолчанию</SelectItem>
              <SelectItem value="price-asc">Сначала дешевле</SelectItem>
              <SelectItem value="price-desc">Сначала дороже</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* ── Products grid ── */}
      <section className="py-10 lg:py-14">
        <div className="max-w-[1440px] mx-auto px-5 lg:px-12">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-28">
              <p className="font-serif text-2xl text-espresso/60">
                В этой категории пока нет товаров
              </p>
              <p className="text-taupe text-sm mt-2">
                Попробуйте другой фильтр или загляните позже
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-10">
              {filteredProducts.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={i}
                  showAddToCart={showAddToCart}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/**
 * Показывает карточку со ссылкой и сроком изготовления из категории товара.
 * При showAddToCart добавляет кнопку корзины для доступных к покупке изделий.
 */
function ProductCard({
  product,
  index,
  showAddToCart,
}: {
  product: Product;
  index: number;
  showAddToCart: boolean;
}) {
  const madeToOrder = getProductMadeToOrder(product);

  return (
    <motion.div
      className="flex flex-col"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.04 * Math.min(index, 8) }}
    >
      <Link
        href={`/catalog/${product.category}/${product.slug}`}
        className="group block"
      >
        {/* Image */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 bg-sand">
          <ProductCardImages
            images={product.images}
            alt={product.name}
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
          />
          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.oldPrice && (
              <span className="label-caps bg-terracotta text-white px-2.5 py-1 rounded-full text-[11px]">
                −{Math.round((1 - product.price / product.oldPrice) * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <h3 className="font-serif text-[17px] text-espresso leading-snug group-hover:text-terracotta transition-colors line-clamp-2">
          {product.name}
        </h3>
        {product.shortDescription && (
          <p className="text-taupe text-[12px] mt-1 line-clamp-2 leading-relaxed">
            {product.shortDescription}
          </p>
        )}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-espresso font-medium text-[15px]">
              {formatPrice(product.price)}
            </span>
            {product.oldPrice && (
              <span className="text-taupe line-through text-[12px]">
                {formatPrice(product.oldPrice)}
              </span>
            )}
          </div>
        </div>
        {product.inStock ? (
          <p className="mt-1.5 label-caps text-[11px] text-sage">В наличии</p>
        ) : madeToOrder ? (
          <p className="mt-1.5 label-caps text-[11px] text-terracotta/90">
            {madeToOrder.badge}
          </p>
        ) : (
          <p className="mt-1.5 label-caps text-[11px] text-taupe">
            Нет в наличии
          </p>
        )}
      </Link>
      {showAddToCart && (
        <div className="mt-auto pt-3">
          <AddToCartButton
            product={product}
            className="w-full h-auto py-2.5 rounded-full bg-espresso hover:bg-terracotta text-parchment label-caps text-[11px] transition-colors"
          />
        </div>
      )}
    </motion.div>
  );
}
