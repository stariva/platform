import { TrackedLink } from "@/components/stariva/tracked-link";
import {
  fallbackWorkshopPrice,
  WORKSHOP_PATH,
  WORKSHOP_TREE_SIZE,
} from "@/lib/elka/data";
import { formatPrice, type Workshop } from "@/lib/workshops-data";

/**
 * Небольшой блок перед вопросами — для тех, кто хочет сплести ёлку сам.
 * Страница про готовые ёлки, поэтому только короткая ссылка на мастер-класс.
 */
export function ElkaDiy({ workshop }: { workshop?: Workshop }) {
  const price = workshop?.price ?? fallbackWorkshopPrice();

  return (
    <section aria-labelledby="diy-title" className="bg-white">
      <div className="max-w-[1100px] mx-auto px-5 lg:px-12 py-12 lg:py-16">
        <div className="flex flex-col gap-5 rounded-[24px] bg-sage-pale p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
          <div>
            <h2
              id="diy-title"
              className="font-serif text-2xl text-espresso mb-2"
            >
              Хотите сплести ёлку сами?
            </h2>
            <p className="text-dark-grey">
              Ольга покажет в видеоуроках, как сплести ёлку {WORKSHOP_TREE_SIZE}
              , даже если вы плетёте впервые. Мастер-класс —{" "}
              {formatPrice(price)}.
            </p>
          </div>
          <TrackedLink
            href={WORKSHOP_PATH}
            goal="elka_trees_workshop"
            className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-espresso/20 hover:border-espresso text-espresso px-6 py-3 transition-colors"
          >
            О мастер-классе
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}
