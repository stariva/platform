import Link from "next/link";
import type { Product } from "@/lib/ozon-types";

export function BuyingGuide({ product }: { product: Product }) {
  const lampshade = product.subcategory === "lampshades";
  if (!lampshade && product.category !== "clothes") return null;
  return (
    <section className="bg-parchment px-5 lg:px-12 py-12 text-espresso">
      <div className="max-w-4xl mx-auto space-y-4 leading-relaxed">
        <h2 className="font-serif text-3xl">
          {lampshade
            ? "Подойдёт ли абажур вашему интерьеру?"
            : "Как подобрать размер изделия"}
        </h2>
        {product.dimensions && (
          <p>
            <strong>Размеры этой модели:</strong> {product.dimensions}.
          </p>
        )}
        {product.material && (
          <p>
            <strong>Материал:</strong> {product.material}.
          </p>
        )}
        {lampshade ? (
          <p>
            Сравните размеры модели с местом установки. Если изделие указано без
            патрона и провода, электрическую часть нужно подобрать отдельно.
            Перед заказом уточните крепление и совместимость с вашим
            светильником.
          </p>
        ) : (
          <p>
            Сверьте указанные размеры со своими мерками. Для топа подготовьте
            обхват груди, для юбки — талии и бёдер, для туники — также желаемую
            длину. Если нужной мерки нет в описании, уточните её у мастерской до
            оплаты.
          </p>
        )}
        <p>
          Оформите заказ на сайте: выберите доставку и проверьте итоговую сумму
          перед оплатой. Индивидуальный размер, стоимость и срок изготовления
          согласуются отдельно.
        </p>
        <div className="flex flex-wrap gap-5">
          <Link
            href={lampshade ? "/abazhury" : "/catalog/clothes"}
            className="underline"
          >
            {lampshade ? "Сравнить все абажуры" : "Сравнить модели одежды"}
          </Link>
          <Link href="/#order" className="underline">
            Уточнить размер у мастерской
          </Link>
          <Link href="/offer" className="underline">
            Условия заказа и возврата
          </Link>
        </div>
      </div>
    </section>
  );
}
