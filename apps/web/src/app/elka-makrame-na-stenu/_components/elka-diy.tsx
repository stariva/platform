import { TrackedLink } from "@/app/elka-makrame/_components/tracked-link";
import {
  LANDING_PATH,
  WORKSHOP_PREORDER_FALLBACK_PRICE,
  WORKSHOP_TREE_SIZE,
} from "@/app/elka-makrame/_data";
import { formatPrice, type Workshop } from "@/lib/workshops-data";

/**
 * Небольшой блок в конце страницы — для тех, кто хочет сплести ёлку сам.
 * Страница про готовые ёлки, поэтому только короткая ссылка на мастер-класс.
 */
export function ElkaDiy({ workshop }: { workshop?: Workshop }) {
  const price = workshop?.price ?? WORKSHOP_PREORDER_FALLBACK_PRICE;

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
            href={LANDING_PATH}
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
