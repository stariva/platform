"use client";

import { CheckIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type SectionStatus = "active" | "done" | "upcoming";

interface CheckoutSectionProps {
  index: number;
  title: string;
  status: SectionStatus;
  /** Что выбрано на пройденном шаге — показываем вместо формы */
  summary?: ReactNode;
  onEdit?: () => void;
  editDisabled?: boolean;
  /** Содержимое остаётся смонтированным и на других шагах (карта, выбранный пункт) */
  keepMounted?: boolean;
  children?: ReactNode;
}

/**
 * Шаг оформления на одной странице: открытый шаг — форма, пройденный —
 * короткая сводка с «Изменить», будущий — только заголовок. Так покупатель
 * видит весь путь целиком и правит любой шаг, не уходя со страницы.
 */
export function CheckoutSection({
  index,
  title,
  status,
  summary,
  onEdit,
  editDisabled,
  keepMounted,
  children,
}: CheckoutSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const wasActive = useRef(status === "active");

  // Открывшийся шаг подводим под глаза и переводим на него фокус
  useEffect(() => {
    const active = status === "active";
    if (active && !wasActive.current) {
      const top = ref.current?.getBoundingClientRect().top ?? 0;
      if (top < 80 || top > window.innerHeight * 0.6) {
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        ref.current?.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
      }
      headingRef.current?.focus({ preventScroll: true });
    }
    wasActive.current = active;
  }, [status]);

  return (
    <section
      ref={ref}
      aria-labelledby={`checkout-step-${index}`}
      className={cn(
        "scroll-mt-24 rounded-2xl transition-colors",
        status === "active"
          ? "border border-espresso/15 bg-white p-5 sm:p-7"
          : "border border-espresso/10 px-5 py-4 sm:px-7 sm:py-5",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums",
            status === "upcoming"
              ? "border border-espresso/15 text-taupe"
              : "bg-espresso text-parchment",
          )}
        >
          {status === "done" ? <CheckIcon className="size-3.5" /> : index}
        </span>
        <h2
          id={`checkout-step-${index}`}
          ref={headingRef}
          tabIndex={-1}
          className={cn(
            "flex-1 font-serif text-xl sm:text-2xl outline-none",
            status === "upcoming" ? "text-taupe" : "text-espresso",
          )}
        >
          {title}
        </h2>
        {status === "done" && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            disabled={editDisabled}
            className="text-[13px] text-espresso underline underline-offset-4 hover:text-taupe transition-colors disabled:opacity-50"
          >
            Изменить
          </button>
        )}
      </div>

      {status === "done" && summary && (
        <div className="mt-3 pl-10 text-sm text-taupe">{summary}</div>
      )}

      {(status === "active" || keepMounted) && (
        <div hidden={status !== "active"} className="mt-6">
          {children}
        </div>
      )}
    </section>
  );
}
