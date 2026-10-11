import Image from "next/image";
import type { Product } from "@/lib/ozon-types";
import { formatPrice } from "@/lib/workshops-data";
import { READY_TREES_ID, type TreeModel } from "../_data";
import { TrackedLink } from "./tracked-link";

export interface ModelWithProduct {
  model: TreeModel;
  product?: Product;
}

/**
 * Небольшой блок в конце страницы — для тех, кто не хочет плести сам.
 * Страница про мастер-класс, поэтому без витрины: только ссылки на карточки.
 */
export function ElkaReadyTrees({ items }: { items: ModelWithProduct[] }) {
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
          Готовые ёлки ручной работы — сплетём под заказ за 2–3 дня и доставим
          по России.
        </p>
        <ul className="grid sm:grid-cols-2 gap-3">
          {items.map(({ model, product }) => (
            <li key={model.slug}>
              <TrackedLink
                href={model.href}
                goal="elka_model_click"
                goalParams={{ slug: model.slug }}
                className="flex items-center gap-4 rounded-2xl bg-parchment p-3 pr-5 hover:bg-linen/60 transition-colors"
              >
                <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-linen">
                  <Image
                    src={product?.images[0] ?? model.fallbackImage}
                    alt={`${model.name}, ${model.size}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </span>
                <span className="flex-1">
                  <span className="block text-espresso">{model.name}</span>
                  <span className="block text-sm text-text-grey">
                    {model.size} ·{" "}
                    {formatPrice(product?.price ?? model.fallbackPrice)}
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
