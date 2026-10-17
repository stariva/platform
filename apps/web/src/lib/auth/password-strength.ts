/**
 * Подсказка о надёжности пароля для форм регистрации и сброса.
 *
 * Обязательное правило одно — длина (совпадает с minPasswordLength better-auth).
 * Оценка надёжности только информирует и ничего не блокирует: требования
 * «цифра + заглавная буква» не делают пароль надёжнее (NIST SP 800-63B),
 * поэтому решающий вклад даёт длина, а разнообразие символов — небольшой бонус.
 */

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordStrength = "weak" | "medium" | "strong";

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "qwertyuiop",
  "11111111",
  "00000000",
  "iloveyou",
  "йцукенгш",
  "пароль123",
]);

function characterClassCount(password: string): number {
  return [/\p{Ll}/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}]/u].filter((re) =>
    re.test(password),
  ).length;
}

/** Строка из одного повторяющегося символа или монотонная последовательность. */
function isTrivialPattern(password: string): boolean {
  if (/^(.)\1+$/u.test(password)) return true;
  const codes = Array.from(password, (ch) => ch.codePointAt(0) ?? 0);
  const step = (codes[1] ?? 0) - (codes[0] ?? 0);
  return (
    Math.abs(step) === 1 &&
    codes.every((c, i) => i === 0 || c - (codes[i - 1] ?? 0) === step)
  );
}

export function passwordStrength(password: string): PasswordStrength {
  const length = Array.from(password).length;
  if (length < PASSWORD_MIN_LENGTH) return "weak";
  if (
    COMMON_PASSWORDS.has(password.toLowerCase()) ||
    isTrivialPattern(password)
  ) {
    return "weak";
  }

  const classes = characterClassCount(password);
  const points =
    (length >= 12 ? 1 : 0) +
    (length >= 16 ? 1 : 0) +
    (classes >= 2 ? 1 : 0) +
    (classes >= 3 ? 1 : 0);

  if (points >= 3) return "strong";
  if (points >= 2) return "medium";
  return "weak";
}
