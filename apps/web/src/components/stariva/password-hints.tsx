"use client";

import { CheckIcon } from "lucide-react";

import {
  PASSWORD_MIN_LENGTH,
  type PasswordStrength,
  passwordStrength,
} from "@/lib/auth/password-strength";
import { cn } from "@/lib/utils";

const STRENGTH_META: Record<
  PasswordStrength,
  { label: string; segments: number }
> = {
  weak: { label: "слабый", segments: 1 },
  medium: { label: "средний", segments: 2 },
  strong: { label: "надёжный", segments: 3 },
};

/**
 * Живая подсказка под полем нового пароля: выполнено ли правило длины
 * и насколько пароль надёжен. Ничего не блокирует — валидация в zod-схеме формы.
 */
export function PasswordHints({ value }: { value: string }) {
  const lengthMet = Array.from(value).length >= PASSWORD_MIN_LENGTH;
  const strength = passwordStrength(value);
  const meta = STRENGTH_META[strength];
  const showStrength = value.length > 0;

  return (
    <div className="space-y-2 text-xs" aria-live="polite">
      <p
        className={cn(
          "flex items-center gap-1.5 transition-colors",
          lengthMet ? "text-espresso" : "text-taupe",
        )}
      >
        <span
          className={cn(
            "flex size-3.5 items-center justify-center rounded-full border transition-colors",
            lengthMet
              ? "border-espresso bg-espresso text-parchment"
              : "border-birch",
          )}
          aria-hidden="true"
        >
          {lengthMet && <CheckIcon className="size-2.5" strokeWidth={3} />}
        </span>
        Минимум {PASSWORD_MIN_LENGTH} символов
        <span className="sr-only">
          {lengthMet ? " — выполнено" : " — не выполнено"}
        </span>
      </p>

      {showStrength && (
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[1, 2, 3].map((segment) => (
              <span
                key={segment}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  segment > meta.segments
                    ? "bg-linen"
                    : strength === "weak"
                      ? "bg-destructive"
                      : "bg-espresso",
                )}
              />
            ))}
          </div>
          <span
            className={cn(
              "shrink-0",
              strength === "weak" ? "text-destructive" : "text-taupe",
            )}
          >
            Пароль {meta.label}
          </span>
        </div>
      )}
    </div>
  );
}
