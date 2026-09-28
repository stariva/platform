// Нормализованные типы поверх официального контракта Ozon Seller API.

export interface DeliveryCheckRequest {
  phone: string;
}

export interface DeliveryCheckResponse {
  available: boolean;
  /** Причина недоступности, если available === false */
  reason?: string;
}

/** Точка из v1/delivery/point/list — Ozon отдаёт только id и координаты. */
export interface PickupPointLocation {
  id: string;
  latitude: number;
  longitude: number;
}

export interface PickupPointPeriod {
  /** "10:00" */
  open: string;
  /** "21:00" */
  close: string;
}

export interface PickupPointDay {
  /** Локальная дата пункта, "YYYY-MM-DD" */
  date: string;
  /** Пустой массив — выходной */
  periods: PickupPointPeriod[];
}

/** Подробности из v1/delivery/point/info, нормализованные для витрины. */
export interface PickupPoint extends PickupPointLocation {
  kind: "pvz" | "postamat";
  /** Улица и дом — главная строка в списке */
  title: string;
  /** Город/населённый пункт */
  locality?: string;
  /** Полный адрес от Ozon */
  address: string;
  /** Как найти пункт — описание от Ozon */
  description?: string;
  schedule: PickupPointDay[];
  /** Периоды, когда пункт не работает, "YYYY-MM-DD" включительно */
  holidays: { from: string; to: string }[];
  rating?: number;
  storageDays?: number;
  imageUrl?: string;
}

export interface PickupPointsNearbyResponse {
  /** Отсортированы по удалённости от запрошенной точки */
  locations: PickupPointLocation[];
  /** Подробности для ближайших пунктов, чтобы список показался сразу */
  nearest: PickupPoint[];
  expanded: boolean;
}

export interface PickupPointDetailsResponse {
  points: PickupPoint[];
  /** Пункты, которые Ozon сейчас не принимает — их нужно скрыть */
  unavailable: string[];
}

export interface CheckoutItem {
  /** fbs_sku или fbo_sku в зависимости от схемы товара */
  sku: number;
  quantity: number;
}

export type DeliverySelection =
  | { method: "pickup"; pointId: string }
  | {
      method: "courier";
      address: string;
      latitude: number;
      longitude: number;
    };

export interface DeliveryCheckoutRequest {
  items: CheckoutItem[];
  delivery: DeliverySelection;
  buyerPhone: string;
}

export interface CheckoutSplitItem {
  sku: number;
  quantity: number;
}

export interface CheckoutSplit {
  deliverySchema: "FBO" | "FBS";
  warehouseId: number;
  items: CheckoutSplitItem[];
  deliveryMethod: {
    id: number;
    type: "COURIER" | "PVZ" | "POSTAMAT";
    timeslotId: number;
    logisticDateFrom: string;
    logisticDateTo: string;
    priceKopecks: number;
  };
}

export interface DeliveryCheckoutResponse {
  available: boolean;
  reason?: string;
  /** Стоимость доставки в копейках */
  deliveryPriceKopecks: number;
  splits: CheckoutSplit[];
}

export interface OrderRecipient {
  name: string;
  phone: string;
  email?: string;
}

export interface CreateOrderRequest {
  items: (CheckoutItem & { price: number })[];
  delivery: DeliverySelection;
  recipient: OrderRecipient;
  /** Снапшот ответа v2/delivery/checkout — состав нельзя менять после checkout */
  checkout: DeliveryCheckoutResponse;
}

export interface CreateOrderResponse {
  orderId: string;
  postingNumbers: string[];
}

export type PostingStatus =
  | "awaiting_packaging"
  | "awaiting_deliver"
  | "delivering"
  | "delivered"
  | "cancelled"
  | (string & {});

export interface Posting {
  postingNumber: string;
  status: PostingStatus;
  trackingUrl?: string;
  updatedAt: string;
}
