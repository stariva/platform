"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, Product, ProductSubcategory } from "@/lib/ozon-types";
import { formatPrice } from "@/lib/products";

interface CategoryFiltersProps {
  products: Product[];
  category: Category;
  categorySlug: string;
}

export default function CategoryFilters({
  products,
  category,
  categorySlug,
}: CategoryFiltersProps) {
  const [activeSubcategory, setActiveSubcategory] = useState<
    ProductSubcategory | "all"
  >("all");
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">(
    "default",
  );

  const filteredProducts = useMemo(() => {
    let result =
      activeSubcategory === "all"
        ? products
        : products.filter((p) => p.subcategory === activeSubcategory);

    if (sortBy === "price-asc")
      result = [...result].sort((a, b) => a.price - b.price);
    else if (sortBy === "price-desc")
      result = [...result].sort((a, b) => b.price - a.price);

    return result;
  }, [products, activeSubcategory, sortBy]);

  const subcategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const sub of category.subcategories) {
      counts[sub.slug] = products.filter(
        (p) => p.subcategory === sub.slug,
      ).length;
    }
    return counts;
  }, [products, category.subcategories]);

  return (
    <>
      {/* ── Filters bar ── */}
      <section className="sticky top-[60px] lg:top-[68px] z-30 bg-parchment/96 backdrop-blur-sm border-b border-espresso/8">
        <div className="max-w-[1440px] mx-auto px-5 lg:px-12 py-4 flex items-center justify-between gap-4 flex-wrap">
          {/* Subcategory pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setActiveSubcategory("all")}
              variant={activeSubcategory === "all" ? "default" : "secondary"}
              size="sm"
              className={`rounded-full label-caps text-[11px] h-auto py-2 transition-all duration-200 ${
                activeSubcategory === "all"
                  ? "bg-espresso text-parchment hover:bg-espresso/90"
                  : "bg-sand text-espresso hover:bg-espresso/10"
              }`}
            >
              Все ({products.length})
            </Button>
            {category.subcategories.map((sub) => (
              <Button
                key={sub.slug}
                onClick={() => setActiveSubcategory(sub.slug)}
                variant={
                  activeSubcategory === sub.slug ? "default" : "secondary"
                }
                size="sm"
                className={`rounded-full label-caps text-[11px] h-auto py-2 transition-all duration-200 ${
                  activeSubcategory === sub.slug
                    ? "bg-espresso text-parchment hover:bg-espresso/90"
                    : "bg-sand text-espresso hover:bg-espresso/10"
                }`}
              >
                {sub.name}
                {(subcategoryCounts[sub.slug] ?? 0) > 0 && (
                  <span className="ml-1.5 opacity-50">
                    ({subcategoryCounts[sub.slug]})
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
              <p className="font-serif text-2xl text-espresso/40">
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
                  categorySlug={categorySlug}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function ProductCard({
  product,
  index,
  categorySlug,
}: {
  product: Product;
  index: number;
  categorySlug: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.04 * Math.min(index, 8) }}
    >
      <Link
        href={`/catalog/${categorySlug}/${product.slug}`}
        className="group block"
      >
        {/* Image */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 bg-sand">
          <Image
            src={product.images[0] ?? "/placeholder.jpg"}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
            unoptimized={(product.images[0] ?? "/placeholder.jpg").startsWith(
              "http",
            )}
          />
          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.oldPrice && (
              <span className="label-caps bg-terracotta text-white px-2.5 py-1 rounded-full text-[10px]">
                −{Math.round((1 - product.price / product.oldPrice) * 100)}%
              </span>
            )}
          </div>
          {/* Quick Ozon link on hover */}
          {product.ozonUrl && (
            <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="flex items-center justify-center gap-1.5 w-full bg-[#005BFF] text-white label-caps text-[10px] py-2 rounded-lg">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M12 7c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5Z"
                    fill="currentColor"
                  />
                </svg>
                Купить на Ozon
              </span>
            </div>
          )}
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
              <span className="text-taupe/60 line-through text-[12px]">
                {formatPrice(product.oldPrice)}
              </span>
            )}
          </div>
          {product.ozonUrl && (
            <span className="label-caps text-[9px] text-[#005BFF] flex items-center gap-1 opacity-60">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M12 7c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5Z"
                  fill="currentColor"
                />
              </svg>
              Ozon
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
