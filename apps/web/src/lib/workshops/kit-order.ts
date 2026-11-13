/**
 * Заказ мастер-класса открыт по оплате набора на сайте, а не куплен отдельно.
 * Идентификатор собирает `kitWorkshopOrderId` из @stariva/web-api — здесь
 * только проверка префикса, чтобы письма не тянули весь пакет.
 */
export function isKitWorkshopOrder(orderId: string): boolean {
  return orderId.startsWith("kit-");
}
