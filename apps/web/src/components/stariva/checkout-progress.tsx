import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const STEPS = ["Корзина", "Контакты", "Доставка", "Оплата"] as const;

/**
 * Путь покупки от корзины до оплаты. Показывает, сколько осталось, и даёт
 * вернуться в корзину — остальные шаги переключаются на странице оформления.
 */
export function CheckoutProgress({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <nav aria-label="Этапы оформления заказа" className="mb-8 lg:mb-10">
      <ol className="flex items-center gap-2 sm:gap-3 text-xs sm:text-[13px]">
        {STEPS.map((label, index) => {
          const done = index < current;
          const active = index === current;
          const content = (
            <>
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium tabular-nums transition-colors",
                  done && "bg-espresso text-parchment",
                  active && "bg-espresso text-parchment ring-4 ring-espresso/8",
                  !done && !active && "border border-espresso/20 text-taupe",
                )}
              >
                {done ? (
                  <CheckIcon className="size-3" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  active ? "text-espresso font-medium" : "text-taupe",
                  // На узком экране подписи у будущих шагов прячем — кружков хватает
                  !active && "max-sm:sr-only",
                )}
              >
                {label}
              </span>
            </>
          );
          return (
            <li
              key={label}
              className="flex items-center gap-2 sm:gap-3 min-w-0"
              aria-current={active ? "step" : undefined}
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px w-4 sm:w-8 lg:w-12",
                    index <= current ? "bg-espresso/40" : "bg-espresso/12",
                  )}
                />
              )}
              {index === 0 && current > 0 ? (
                <Link
                  href="/cart"
                  className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-70"
                >
                  {content}
                </Link>
              ) : (
                <span className="flex items-center gap-2">{content}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
