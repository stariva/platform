/** Сколько дней у покупателя на оплату выставленного этапа. */
export const PAYMENT_WINDOW_DAYS = 3;

export function paymentDueFrom(now: Date): Date {
  return new Date(now.getTime() + PAYMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/** Рубли из формы мастера → копейки. */
export const toKopecks = (rubles: number) => Math.round(rubles * 100);

/** Предоплата — половина стоимости изделий без доставки, до целого рубля. */
export function depositFor(amountProducts: number): number {
  return Math.round(amountProducts / 200) * 100;
}
