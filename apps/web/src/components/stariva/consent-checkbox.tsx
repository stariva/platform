"use client";

import Link from "next/link";
import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface ConsentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: React.ReactNode;
  error?: string;
  className?: string;
}

/** Отдельный чекбокс согласия (ст. 9 152-ФЗ): не отмечен по умолчанию. */
export function ConsentCheckbox({
  checked,
  onCheckedChange,
  children,
  error,
  className,
}: ConsentCheckboxProps) {
  const id = useId();
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 border-espresso/30 data-[state=checked]:bg-terracotta data-[state=checked]:border-terracotta data-[state=checked]:text-parchment"
        />
        <label
          htmlFor={id}
          className="text-[12px] leading-relaxed text-taupe cursor-pointer text-left"
        >
          {children}
        </label>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-[12px] text-destructive pl-6">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const linkClass = "text-terracotta underline-offset-2 hover:underline";

export function PersonalDataConsentLabel() {
  return (
    <>
      Даю{" "}
      <Link href="/personal-data-consent" target="_blank" className={linkClass}>
        согласие на обработку персональных данных
      </Link>{" "}
      на условиях{" "}
      <Link href="/privacy-policy" target="_blank" className={linkClass}>
        политики конфиденциальности
      </Link>
    </>
  );
}

export function MarketingConsentLabel() {
  return (
    <>
      Согласен(на) получать рекламные и информационные рассылки Stariva на
      указанный email. Отписаться можно в любой момент.
    </>
  );
}

export function OfferAcceptanceNote({
  action,
  className,
}: {
  action?: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[12px] leading-relaxed text-taupe text-center",
        className,
      )}
    >
      {action ? `Нажимая «${action}»` : "Нажимая кнопку оплаты"}, вы принимаете
      условия{" "}
      <Link href="/offer" target="_blank" className={linkClass}>
        публичной оферты
      </Link>
      .
    </p>
  );
}

export const PD_CONSENT_ERROR =
  "Нужно согласие на обработку персональных данных";
