/**
 * Телефон без пробелов, скобок и дефисов; российский «8…» и мобильный без
 * кода страны «9…» приводятся к «7…».
 */
export function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8"))
    return `7${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `7${digits}`;
  return digits;
}

export function phonesMatch(a: string, b: string): boolean {
  const left = normalizePhoneDigits(a);
  return left.length > 0 && left === normalizePhoneDigits(b);
}
