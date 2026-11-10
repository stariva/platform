import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { TrackedLink } from "@/components/stariva/tracked-link";
import { BONUS_TREE_SIZE, WORKSHOP_TREE_SIZE } from "@/lib/elka/data";
import type { WorkshopBundle } from "@/lib/workshops/bundles";
import {
  formatLessonsCount,
  formatPrice,
  formatReleaseDate,
  isPreorder,
  type Workshop,
} from "@/lib/workshops-data";
import { komboOffer } from "../../elka-makrame-kombo/_data";
import { BIG_TREE_ID, TARIFFS_ID, WORKSHOP_BUY_ID } from "../_data";
import { WorkshopPreorderButton } from "./workshop-preorder-button";

/**
 * Три формата участия: ёлка, большая ёлка и обе сразу. Цены живые — из
 * админки и настроек комбо, поэтому экономия на странице всегда честная.
 * Показывается после старта уроков, когда продаются оба мастер-класса.
 */
export function ElkaTariffs({
  workshop,
  bigTree,
  bundle,
}: {
  workshop: Workshop;
  bigTree: Workshop;
  bundle?: WorkshopBundle;
}) {
  const bigPreorder = isPreorder(bigTree) && bigTree.releaseAt;
  const kombo = bundle ? komboOffer(bundle, workshop, bigTree) : undefined;

  return (
    <section
      id={TARIFFS_ID}
      aria-labelledby="tariffs-title"
      className="bg-parchment scroll-mt-24"
    >
      <div className="max-w-[1440px] mx-auto px-5 lg:px-12 py-16 lg:py-24">
        <h2
          id="tariffs-title"
          className="font-serif text-espresso leading-tight text-balance mb-3"
          style={{ fontSize: "clamp(28px, 3.4vw, 44px)" }}
        >
          Выберите свой формат участия
        </h2>
        <p className="mb-10 max-w-2xl text-dark-grey leading-relaxed">
          Одна ёлка, большая в полтора метра или обе сразу — уроки откроются в
          личном кабинете после оплаты.
        </p>

        <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
          <TariffCard
            name={`Ёлка ${WORKSHOP_TREE_SIZE}`}
            price={workshop.price}
            audience="Для тех, кто хочет впервые попробовать макраме или сплести аккуратную ёлочку для уютного уголка, детской или в подарок близким."
            items={[
              `Подробные видеоуроки в личном кабинете${workshop.lessonsCount > 0 ? ` (${formatLessonsCount(workshop.lessonsCount)})` : ""} — от нарезки нитей до пышной бахромы`,
              "Схема и список материалов с расчётом шнура",
              "Доступ навсегда и чат участниц, где я помогаю",
            ]}
          >
            <TrackedLink
              href={`#${WORKSHOP_BUY_ID}`}
              goal="elka_tariff_small"
              className="flex w-full items-center justify-center rounded-2xl bg-terracotta py-4 text-center text-parchment transition-colors hover:bg-terracotta-dark"
            >
              Купить мастер-класс за {formatPrice(workshop.price)}
            </TrackedLink>
          </TariffCard>

          <TariffCard
            id={BIG_TREE_ID}
            name={`Большая ёлка ${BONUS_TREE_SIZE}`}
            price={bigTree.price}
            oldPrice={bigPreorder ? bigTree.regularPrice : undefined}
            badge={
              bigPreorder
                ? `Предзаказ до ${formatReleaseDate(bigPreorder)}`
                : undefined
            }
            audience="Для просторной гостиной, загородного дома или фотозоны — ёлка в полтора метра, которая заменит обычную напольную."
            items={[
              `Отдельный мастер-класс в видеоуроках по ёлке ${BONUS_TREE_SIZE}`,
              "Схема, расчёт шнура и список материалов под большой размер",
              "Доступ навсегда и моя помощь в чате участниц",
            ]}
          >
            <WorkshopPreorderButton
              slug={bigTree.slug}
              price={bigTree.price}
              title={bigTree.title}
              preorder={Boolean(bigPreorder)}
              goal="elka_big_tree_buy"
              buyLabel={
                bigPreorder
                  ? undefined
                  : `Купить мастер-класс за ${formatPrice(bigTree.price)}`
              }
            />
          </TariffCard>

          {bundle && kombo ? (
            <TariffCard
              highlighted
              name="Оба мастер-класса"
              note="Ёлки двух размеров"
              price={kombo.price}
              oldPrice={kombo.saving > 0 ? kombo.separately : undefined}
              badge={
                kombo.saving > 0
                  ? `Выгоднее на ${formatPrice(kombo.saving)}`
                  : undefined
              }
              audience="Для тех, кто хочет сплести пару ёлок для разных комнат, порадовать близких подарками или плести на заказ к праздникам."
              items={[
                `Сразу два мастер-класса: ёлка ${WORKSHOP_TREE_SIZE} и большая ${BONUS_TREE_SIZE}`,
                "Все схемы, расчёты шнура и списки материалов",
                ...(kombo.saving > 0
                  ? [
                      `Экономия ${formatPrice(kombo.saving)} по сравнению с покупкой по отдельности`,
                    ]
                  : []),
              ]}
            >
              <WorkshopPreorderButton
                slug={workshop.slug}
                bundle={bundle.slug}
                price={kombo.price}
                title={`Комбо «${bundle.title}»`}
                preorder={false}
                goal="elka_kombo_buy"
                buyLabel={`Купить оба за ${formatPrice(kombo.price)}`}
              />
            </TariffCard>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TariffCard({
  id,
  name,
  note,
  price,
  oldPrice,
  badge,
  audience,
  items,
  highlighted = false,
  children,
}: {
  id?: string;
  name: string;
  note?: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  audience: string;
  items: string[];
  highlighted?: boolean;
  /** Кнопка или форма оплаты. */
  children: ReactNode;
}) {
  return (
    <article
      id={id}
      className={`flex flex-col rounded-[24px] bg-white p-6 lg:p-8 scroll-mt-24 border ${
        highlighted ? "border-terracotta" : "border-espresso/10"
      }`}
    >
      {badge ? (
        <p className="mb-3 self-start rounded-full bg-terracotta px-3 py-1 text-xs text-parchment">
          {badge}
        </p>
      ) : null}
      <h3 className="font-serif text-2xl text-espresso">{name}</h3>
      {note ? <p className="mt-1 text-sm text-text-grey">{note}</p> : null}
      <p className="mt-3 mb-5 text-sm leading-relaxed text-dark-grey">
        {audience}
      </p>
      <ul className="mb-6 grid gap-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <Check className="size-4 text-sage mt-0.5 shrink-0" aria-hidden />
            <span className="text-espresso">{item}</span>
          </li>
        ))}
      </ul>
      <div className="mb-5 flex items-baseline gap-3">
        <span className="font-serif text-3xl text-espresso whitespace-nowrap">
          {formatPrice(price)}
        </span>
        {oldPrice ? (
          <s className="text-text-grey whitespace-nowrap">
            {formatPrice(oldPrice)}
          </s>
        ) : null}
      </div>
      {children}
    </article>
  );
}
