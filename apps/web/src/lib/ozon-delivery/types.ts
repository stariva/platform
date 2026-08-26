// Нормализованные типы поверх официального контракта Ozon Seller API.

export interface DeliveryCheckRequest {
  phone: string;
}

export interface DeliveryCheckResponse {
  available: boolean;
  /** Причина недоступности, если available === false */
  reason?: string;
}

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  workSchedule?: string;
}

export interface PickupPointListResponse {
  points: PickupPoint[];
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
