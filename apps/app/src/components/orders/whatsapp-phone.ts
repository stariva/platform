import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/** WhatsApp requires a valid international number, without the leading +. */
export function whatsappPhone(raw: string): string | null {
  const value = raw.trim();
  if (!/^\+?[\d\s()-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  // Without +, accept only the explicit Russian country/trunk prefix.
  if (!value.startsWith("+") && !/^[78]\d{10}$/.test(digits)) return null;
  const phone = parsePhoneNumberFromString(value, {
    defaultCountry: "RU",
    extract: false,
  });
  return phone?.isValid() ? phone.number.slice(1) : null;
}
