"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const CODE_DIGITS = 6;

/** Код копируют из сообщения как «482 719» или «482-719» — оставляем только цифры. */
function digitsOnly(text: string): string {
  return text.replace(/\D/g, "").slice(0, CODE_DIGITS);
}

/** Три клетки подряд: код читается как «482 719», так же, как в сообщении. */
function codeGroup(slots: number[], invalid: boolean) {
  return (
    <InputOTPGroup className="flex-1">
      {slots.map((index) => (
        <InputOTPSlot
          key={index}
          index={index}
          aria-invalid={invalid || undefined}
          className="h-13 min-w-0 flex-1 bg-parchment font-mono text-2xl text-espresso first:rounded-l-xl last:rounded-r-xl"
        />
      ))}
    </InputOTPGroup>
  );
}

interface CodeInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Введена последняя цифра. */
  onComplete?: (value: string) => void;
  /** id текста ошибки; есть — клетки подсвечены. */
  errorId?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** "one-time-code" — телефон сам подставит код из письма или SMS. */
  autoComplete?: string;
}

/** Шесть клеток для кода из письма или сообщения. */
export function CodeInput({
  id,
  value,
  onChange,
  onComplete,
  errorId,
  disabled,
  autoFocus,
  autoComplete = "off",
}: CodeInputProps) {
  return (
    <InputOTP
      id={id}
      maxLength={CODE_DIGITS}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      pasteTransformer={digitsOnly}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      required
      aria-invalid={errorId ? true : undefined}
      aria-describedby={errorId}
      containerClassName="w-full gap-1 sm:gap-2"
    >
      {codeGroup([0, 1, 2], Boolean(errorId))}
      <InputOTPSeparator className="text-taupe" />
      {codeGroup([3, 4, 5], Boolean(errorId))}
    </InputOTP>
  );
}
