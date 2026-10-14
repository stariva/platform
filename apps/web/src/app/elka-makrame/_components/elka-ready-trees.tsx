import Image from "next/image";
import { TrackedLink } from "@/components/stariva/tracked-link";
import type { Product } from "@/lib/catalog/types";
import { TREES_PATH, treeDetails } from "@/lib/elka/data";
import { madeToOrderLeadTimeOf } from "@/lib/made-to-order";
import { productHref } from "@/lib/products";
import { formatPrice } from "@/lib/workshops-data";
import { READY_TREES_ID } from "../_data";

/**
 * Небольшой блок в конце страницы — для тех, кто не хочет плести сам.
 * Страница про мастер-класс, поэтому без витрины: только ссылки на карточки.
 */
export function ElkaReadyTrees({ trees }: { trees: Product[] }) {
  if (trees.length === 0) return null;
  return (
    <section
      id={READY_TREES_ID}
      aria-labelledby="ready-trees-title"
      className="bg-white scroll-mt-24"
    >
      <div className="max-w-[1100px] mx-auto px-5 lg:px-12 py-12 lg:py-16">
        <h2
          id="ready-trees-title"
          className="font-serif text-2xl text-espresso mb-2"
        >
          Нет времени плести?
        </h2>
        <p className="text-dark-grey mb-6">
          Готовая ёлка ручной работы плетётся за {madeToOrderLeadTimeOf(trees)},
          доставка — по всей России.{" "}
          <TrackedLink
            href={TREES_PATH}
            goal="elka_ready_trees_page"
            className="underline underline-offset-4 hover:text-terracotta"
          >
            Всё о готовых ёлках
          </TrackedLink>
        </p>
        <ul className="grid sm:grid-cols-2 gap-3">
          {trees.map((product) => (
            <li key={product.id}>
              <TrackedLink
                href={productHref(product)}
                goal="elka_model_click"
                goalParams={{ slug: product.slug }}
                className="flex items-center gap-4 rounded-2xl bg-parchment p-3 pr-5 hover:bg-linen/60 transition-colors"
              >
                <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-linen">
                  {product.images[0] ? (
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : null}
                </span>
                <span className="flex-1">
                  <span className="block text-espresso">{product.name}</span>
                  <span className="block text-sm text-text-grey">
                    {[treeDetails(product), formatPrice(product.price)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span aria-hidden className="text-terracotta">
                  →
                </span>
              </TrackedLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
