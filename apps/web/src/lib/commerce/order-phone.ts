/**
 * Телефон, по которому покупатель только что оформил заказ, — чтобы страница
 * заказа открылась сразу, без повторного ввода. Живёт до закрытия вкладки;
 * если хранилище недоступно, покупатель просто введёт телефон сам.
 */
const key = (orderId: string) => `stariva:order-phone:${orderId}`;

export function rememberOrderPhone(orderId: string, phone: string): void {
  try {
    sessionStorage.setItem(key(orderId), phone);
  } catch {
    /* хранилище недоступно */
  }
}

export function recallOrderPhone(orderId: string): string | null {
  try {
    return sessionStorage.getItem(key(orderId));
  } catch {
    return null;
  }
}
