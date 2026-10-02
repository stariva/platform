/** Телефон без пробелов, скобок и дефисов; российский «8…» приводится к «7…». */
export function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("8")
    ? `7${digits.slice(1)}`
    : digits;
}

export function phonesMatch(a: string, b: string): boolean {
  const left = normalizePhoneDigits(a);
  return left.length > 0 && left === normalizePhoneDigits(b);
}
