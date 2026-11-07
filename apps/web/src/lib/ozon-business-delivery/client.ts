import type { MadeToOrderParcel } from "@stariva/web-api/contract";

/**
 * Ozon Доставка для бизнеса (Delivery API): посылка без карточки товара и
 * остатков на Ozon. Отдельный кабинет и свои ключи, не путать с Seller API в
 * lib/ozon-delivery, через который идут заказы из наличия.
 *
 * Запросы пишутся по официальной инструкции Ozon, её текст ещё не получен.
 * Пока здесь false, кнопка мастера объясняет это, а доплата выставляется с
 * ручной стоимостью доставки.
 */
export function isOzonBusinessDeliveryConfigured(): boolean {
  return false;
}

export interface ParcelRequest {
  recipientPhone: string;
  /** Пункт выдачи, который выбрал покупатель. */
  pointId: string;
  parcel: MadeToOrderParcel;
  /** Объявленная стоимость для страховки, копейки. */
  declaredValueKopecks: number;
}

export type ParcelQuote =
  | {
      available: true;
      /** Перевозка и страховка, копейки. */
      priceKopecks: number;
    }
  | { available: false; reason?: string };

export interface CreateParcelRequest extends ParcelRequest {
  /** Наш заказ: повтор webhook не должен создать вторую посылку. */
  externalOrderId: string;
  recipientName: string;
  items: { name: string; quantity: number; priceKopecks: number }[];
}

export interface CreatedParcel {
  orderId: string;
  postingNumbers: string[];
}

const NOT_IMPLEMENTED = "ozon_business_delivery_not_implemented";

/** Условия доставки посылки до пункта. В Ozon ничего не создаёт. */
export async function quoteParcel(
  _request: ParcelRequest,
): Promise<ParcelQuote> {
  throw new Error(NOT_IMPLEMENTED);
}

/**
 * Создаёт заказ и подтверждает отправление к отгрузке: у Ozon это два шага, и
 * подтверждение требует положительного баланса кабинета доставки.
 */
export async function createParcelShipment(
  _request: CreateParcelRequest,
): Promise<CreatedParcel> {
  throw new Error(NOT_IMPLEMENTED);
}
