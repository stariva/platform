"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { WorkshopPurchase } from "@/app/workshops/[slug]/workshop-purchase";
import { reachGoal } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/workshops-data";
import {
  BUY_ID,
  choiceHash,
  type KomboChoice,
  type KomboChoiceId,
  SECTION_ID,
} from "../_data";

const CHOICE_EVENT = "stariva:kombo-choice";

/**
 * Ссылка «Купить отдельно»: выбирает ёлку в форме оплаты и прокручивает к
 * ней. Без навигации по hash: роутер Next перехватывает её и сбивает
 * прокрутку. href остаётся на случай клика до гидрации.
 */
export function KomboChoiceLink({
  choice,
  className,
  children,
}: {
  choice: Exclude<KomboChoiceId, "kombo">;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={`#${choiceHash(choice)}`}
      onClick={(event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey) return;
        event.preventDefault();
        reachGoal("elka_kombo_single_cta", { choice });
        window.dispatchEvent(new CustomEvent(CHOICE_EVENT, { detail: choice }));
      }}
      className={className}
    >
      {children}
    </a>
  );
}

/**
 * Форма оплаты лендинга комбо: по умолчанию комбо, но можно взять и одну
 * ёлку. Её выбирают ссылки «Купить отдельно» и адреса вида
 * `/elka-makrame-kombo#kombo-buy-big` — например, из рекламы.
 */
export function KomboPurchase({
  choices,
  path,
}: {
  choices: [KomboChoice, ...KomboChoice[]];
  /** Адрес лендинга — куда вернуть после входа. */
  path: string;
}) {
  const [selectedId, setSelectedId] = useState<KomboChoiceId>("kombo");
  const [buying, setBuying] = useState(false);
  const buyingRef = useRef(false);
  const selected =
    choices.find((choice) => choice.id === selectedId) ?? choices[0];

  useEffect(() => {
    const showForm = (id: KomboChoiceId, focus = false) => {
      if (buyingRef.current) return;
      setSelectedId(id);
      document.getElementById(BUY_ID)?.scrollIntoView({ block: "start" });
      if (focus) {
        document
          .getElementById(`${BUY_ID}-${id}-choice`)
          ?.focus({ preventScroll: true });
      }
    };
    const onChoice = (event: Event) =>
      showForm((event as CustomEvent<KomboChoiceId>).detail, true);
    const applyHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) {
        if (!buyingRef.current) setSelectedId("kombo");
        return;
      }
      const fromHash = choices.find((item) =>
        item.id === "kombo"
          ? hash === SECTION_ID || hash === BUY_ID
          : choiceHash(item.id) === hash,
      );
      if (fromHash) showForm(fromHash.id);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    window.addEventListener(CHOICE_EVENT, onChoice);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener(CHOICE_EVENT, onChoice);
    };
  }, [choices]);

  function changeBuying(value: boolean) {
    buyingRef.current = value;
    setBuying(value);
  }

  function pick(id: KomboChoiceId) {
    if (buyingRef.current) return;
    setSelectedId(id);
    reachGoal("elka_kombo_pick", { choice: id });
  }

  return (
    <>
      <fieldset className="mb-5">
        <legend className="font-serif text-xl text-espresso mb-4">
          Что купить
        </legend>
        <div className="grid gap-2.5">
          {choices.map((choice) => {
            const checked = choice.id === selected.id;
            return (
              <label
                key={choice.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-terracotta/40",
                  checked
                    ? "border-terracotta bg-terracotta/5"
                    : "border-espresso/10 hover:border-espresso/25",
                )}
              >
                <input
                  id={`${BUY_ID}-${choice.id}-choice`}
                  type="radio"
                  name="kombo-choice"
                  value={choice.id}
                  checked={checked}
                  disabled={buying}
                  onChange={() => pick(choice.id)}
                  className="mt-1 size-4 shrink-0 accent-terracotta"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-espresso font-medium">
                    {choice.name}
                  </span>
                  <span className="text-sm text-text-grey whitespace-nowrap">
                    {choice.note}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end text-right">
                  <span className="font-serif text-xl leading-tight text-espresso whitespace-nowrap">
                    {formatPrice(choice.price)}
                  </span>
                  {choice.oldPrice ? (
                    <s className="text-sm text-text-grey whitespace-nowrap">
                      {formatPrice(choice.oldPrice)}
                    </s>
                  ) : null}
                  {choice.badge ? (
                    <span
                      className={cn(
                        "mt-1 rounded-full px-2 py-0.5 text-xs",
                        choice.id === "kombo"
                          ? "bg-terracotta text-parchment"
                          : "bg-sage-pale text-espresso",
                      )}
                    >
                      {choice.badge}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="text-sm text-text-grey mb-6">{selected.summary}</p>
      <WorkshopPurchase
        slug={selected.slug}
        bundle={selected.bundle}
        price={selected.price}
        title={selected.title}
        returnPath={`${path}#${selected.id === "kombo" ? SECTION_ID : choiceHash(selected.id)}`}
        buying={buying}
        onBuyingChange={changeBuying}
        preorder={selected.preorder}
        buyLabel={selected.buyLabel}
        buyGoal={selected.buyGoal}
      />
      <ol
        aria-label="Как проходит запись"
        className="mt-5 grid gap-3 border-t border-espresso/10 pt-5 text-sm text-dark-grey"
      >
        {[
          "Оплата картой или СБП через ЮKassa — без регистрации",
          "Сразу после оплаты — письмо со ссылкой на личный кабинет",
          selected.access,
        ].map((step, index) => (
          <li key={step} className="flex gap-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sage-pale font-serif text-xs text-espresso">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </>
  );
}
