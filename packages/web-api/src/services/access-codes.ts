import { randomInt } from "node:crypto";

/**
 * Код доступа — 6 цифр: легко запомнить, пока переключаешься из чата
 * Ярмарки в браузер, а на телефоне открывается цифровая клавиатура. Миллиона
 * вариантов против перебора хватает вместе с пределом попыток на IP; 4 цифр
 * уже мало — при паре десятков неактивированных кодов их можно угадать.
 */
export const ACCESS_CODE_LENGTH = 6;

/** Новый случайный код, «482719». */
export function generateAccessCode(): string {
  let code = "";
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) code += randomInt(10);
  return code;
}

/**
 * Код из того, что ввёл покупатель: пробелы, дефисы и прочее убираем.
 * null — цифр не столько, сколько в коде.
 */
export function normalizeAccessCode(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === ACCESS_CODE_LENGTH ? digits : null;
}

/** Код для чтения глазами: «482 719». */
export function formatAccessCode(code: string): string {
  const half = ACCESS_CODE_LENGTH / 2;
  return `${code.slice(0, half)} ${code.slice(half)}`;
}
