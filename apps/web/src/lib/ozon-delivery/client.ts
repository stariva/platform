import { z } from "zod";
import { getOzonDeliveryToken, isOzonDeliveryConfigured } from "./auth";
import { normalizePointInfo, pointInfoSchema } from "./point-info";
import type {
  CheckoutSplit,
  CreateOrderRequest,
  CreateOrderResponse,
  DeliveryCheckoutRequest,
  DeliveryCheckoutResponse,
  DeliveryCheckResponse,
  DeliverySelection,
  PickupPoint,
  PickupPointLocation,
  Posting,
} from "./types";

export { isOzonDeliveryConfigured };

const BASE_URL = "https://api-seller.ozon.ru";
const positiveInteger = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
const isoDate = z.string().datetime({ offset: true });
const moneySchema = z.object({
  amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  currency: z.literal("RUB"),
});

const deliveryCheckSchema = z.object({ is_possible: z.boolean() });
// Список пунктов по всей стране — десятки тысяч элементов. Поэлементная
// zod-схема строила бы полную копию массива и на пике выбивала под по
// памяти, поэтому здесь проверяем только оболочку, а точки — вручную.
const pickupPointListSchema = z.object({ points: z.array(z.unknown()) });
const pointInfoResponseSchema = z.object({
  points: z.array(pointInfoSchema),
});
const POINT_INFO_BATCH_SIZE = 100;
// Сплит, который Ozon не может доставить, приходит без способа доставки
// и с warehouse_id = 0 — такие сплиты отбрасываются в checkout().
const checkoutResponseSchema = z.object({
  splits: z.array(
    z.object({
      commissions: z.object({ total: moneySchema }).nullable().optional(),
      delivery_method: z
        .object({
          id: positiveInteger,
          delivery_type: z.enum(["COURIER", "PVZ", "POSTAMAT"]),
          unavailable_reason: z.string().optional(),
          timeslots: z.array(
            z.object({
              timeslot_id: positiveInteger,
              logistic_date_range: z.object({ from: isoDate, to: isoDate }),
            }),
          ),
        })
        .nullable()
        .optional(),
      delivery_schema: z.enum(["FBO", "FBS", "UNSPECIFIED"]),
      items: z.array(
        z.object({ sku: positiveInteger, quantity: positiveInteger }),
      ),
      unavailable_reason: z.string().optional(),
      warehouse_id: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    }),
  ),
});
const createOrderResponseSchema = z.object({
  order_number: z.string().min(1),
  postings: z.array(z.string().min(1)),
});
const postingSchema = z.object({
  result: z.object({
    posting_number: z.string().min(1),
    status: z.string().min(1),
    in_process_at: isoDate,
  }),
});
const cancelOrderResponseSchema = z.object({ message: z.string().optional() });

async function ozonDeliveryFetch<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const token = await getOzonDeliveryToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ozon_delivery_request_failed_${res.status}: ${detail}`);
  }

  return schema.parse(await res.json());
}

function deliveryPayload(delivery: DeliverySelection) {
  if (delivery.method === "pickup") {
    const pointId = Number(delivery.pointId);
    if (!Number.isSafeInteger(pointId) || pointId <= 0) {
      throw new Error("ozon_delivery_invalid_pickup_point");
    }
    return { pick_up: { map_point_id: pointId } };
  }

  return {
    courier: {
      coordinates: {
        latitude: delivery.latitude,
        longitude: delivery.longitude,
      },
    },
  };
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(digits)) {
    throw new Error("ozon_delivery_invalid_phone");
  }
  return digits;
}

function rublesToKopecks(value: string): number {
  const kopecks = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(kopecks) || kopecks < 0) {
    throw new Error("ozon_delivery_invalid_price");
  }
  return kopecks;
}

export async function checkDeliveryAvailable(
  phone: string,
): Promise<DeliveryCheckResponse> {
  const data = await ozonDeliveryFetch(
    "/v1/delivery/check",
    { client_phone: normalizePhone(phone) },
    deliveryCheckSchema,
  );
  return { available: data.is_possible };
}

// Ozon отдаёт здесь только id и координаты — адрес, режим работы и
// остальное берутся из getPickupPointsInfo.
export async function listPickupPoints(): Promise<PickupPointLocation[]> {
  const data = await ozonDeliveryFetch(
    "/v1/delivery/point/list",
    {},
    pickupPointListSchema,
  );
  const locations: PickupPointLocation[] = [];
  for (const raw of data.points) {
    const point = raw as {
      map_point_id?: unknown;
      coordinate?: { lat?: unknown; long?: unknown } | null;
    } | null;
    const id = point?.map_point_id;
    const lat = point?.coordinate?.lat;
    const long = point?.coordinate?.long;
    if (
      !Number.isSafeInteger(id) ||
      (id as number) <= 0 ||
      typeof lat !== "number" ||
      typeof long !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(long)
    ) {
      continue;
    }
    locations.push({ id: String(id), latitude: lat, longitude: long });
  }
  return locations;
}

/**
 * Подробности о пунктах выдачи (не больше 100 id за запрос к Ozon).
 * В `unavailable` попадают пункты, которые Ozon вернул выключенными
 * или без адреса — показывать их покупателю нельзя.
 */
export async function getPickupPointsInfo(
  ids: string[],
  knownLocations?: Map<string, PickupPointLocation>,
): Promise<{ points: PickupPoint[]; unavailable: string[] }> {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += POINT_INFO_BATCH_SIZE) {
    batches.push(ids.slice(i, i + POINT_INFO_BATCH_SIZE));
  }
  const responses = await Promise.all(
    batches.map((batch) =>
      ozonDeliveryFetch(
        "/v1/delivery/point/info",
        { map_point_ids: batch },
        pointInfoResponseSchema,
      ),
    ),
  );

  const points: PickupPoint[] = [];
  const found = new Set<string>();
  for (const info of responses.flatMap((response) => response.points)) {
    const point =
      info.enabled === false
        ? null
        : normalizePointInfo(
            info,
            knownLocations?.get(String(info.delivery_method.map_point_id)),
          );
    if (!point) continue;
    points.push(point);
    found.add(point.id);
  }
  return { points, unavailable: ids.filter((id) => !found.has(id)) };
}

export async function checkout(
  request: DeliveryCheckoutRequest,
): Promise<DeliveryCheckoutResponse> {
  const data = await ozonDeliveryFetch(
    "/v2/delivery/checkout",
    {
      buyer_phone: normalizePhone(request.buyerPhone),
      delivery_schema: "MIX",
      delivery_type: deliveryPayload(request.delivery),
      items: request.items,
    },
    checkoutResponseSchema,
  );

  const splits: CheckoutSplit[] = [];
  for (const split of data.splits) {
    const method = split.delivery_method;
    const timeslot = method?.timeslots[0];
    if (
      split.delivery_schema === "UNSPECIFIED" ||
      (split.unavailable_reason !== undefined &&
        split.unavailable_reason !== "UNSPECIFIED") ||
      !method ||
      (method.unavailable_reason !== undefined &&
        method.unavailable_reason !== "UNSPECIFIED") ||
      split.warehouse_id <= 0 ||
      !split.commissions ||
      !timeslot
    ) {
      continue;
    }
    splits.push({
      deliverySchema: split.delivery_schema,
      warehouseId: split.warehouse_id,
      items: split.items,
      deliveryMethod: {
        id: method.id,
        type: method.delivery_type,
        timeslotId: timeslot.timeslot_id,
        logisticDateFrom: timeslot.logistic_date_range.from,
        logisticDateTo: timeslot.logistic_date_range.to,
        priceKopecks: rublesToKopecks(split.commissions.total.amount),
      },
    });
  }

  const requested = new Map(
    request.items.map((item) => [item.sku, item.quantity]),
  );
  const quoted = new Map<number, number>();
  for (const split of splits) {
    for (const item of split.items) {
      quoted.set(item.sku, (quoted.get(item.sku) ?? 0) + item.quantity);
    }
  }
  const available =
    splits.length > 0 &&
    requested.size === quoted.size &&
    [...requested].every(([sku, quantity]) => quoted.get(sku) === quantity);
  return {
    available,
    reason: available ? undefined : "Доставка выбранных товаров недоступна",
    deliveryPriceKopecks: available
      ? splits.reduce(
          (sum, split) => sum + split.deliveryMethod.priceKopecks,
          0,
        )
      : 0,
    splits: available ? splits : [],
  };
}

function splitName(name: string): { firstName: string; lastName: string } {
  const [firstName = "", ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") || firstName };
}

function pricePayload(kopecks: number) {
  return {
    currency_code: "RUB",
    units: Math.floor(kopecks / 100),
    nanos: (kopecks % 100) * 10_000_000,
  };
}

export async function createOzonDeliveryOrder(
  request: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  if (request.delivery.method === "courier") {
    throw new Error("ozon_delivery_courier_order_not_supported");
  }

  const recipient = splitName(request.recipient.name);
  const recipientPhone = normalizePhone(request.recipient.phone);
  const prices = new Map(request.items.map((item) => [item.sku, item.price]));
  const schemas = new Set(request.checkout.splits.map((s) => s.deliverySchema));
  const data = await ozonDeliveryFetch(
    "/v2/order/create",
    {
      buyer: {
        first_name: recipient.firstName,
        last_name: recipient.lastName,
        phone: recipientPhone,
      },
      recipient: {
        recipient_first_name: recipient.firstName,
        recipient_last_name: recipient.lastName,
        recipient_phone: recipientPhone,
      },
      delivery: deliveryPayload(request.delivery),
      delivery_schema: schemas.size === 1 ? [...schemas][0] : "MIX",
      splits: request.checkout.splits.map((split) => ({
        warehouse_id: split.warehouseId,
        delivery_method: {
          delivery_method_id: split.deliveryMethod.id,
          delivery_type: split.deliveryMethod.type,
          timeslot_id: split.deliveryMethod.timeslotId,
          logistic_date_range: {
            from: split.deliveryMethod.logisticDateFrom,
            to: split.deliveryMethod.logisticDateTo,
          },
          price: pricePayload(split.deliveryMethod.priceKopecks),
        },
        items: split.items.map((item) => {
          const price = prices.get(item.sku);
          if (price === undefined) throw new Error("ozon_delivery_unknown_sku");
          return { ...item, price: pricePayload(price) };
        }),
      })),
    },
    createOrderResponseSchema,
  );
  return { orderId: data.order_number, postingNumbers: data.postings };
}

export async function getFbsPosting(postingNumber: string): Promise<Posting> {
  const data = await ozonDeliveryFetch(
    "/v3/posting/fbs/get",
    { posting_number: postingNumber },
    postingSchema,
  );
  return {
    postingNumber: data.result.posting_number,
    status: data.result.status,
    updatedAt: data.result.in_process_at,
  };
}

export async function getFboPosting(postingNumber: string): Promise<Posting> {
  const data = await ozonDeliveryFetch(
    "/v2/posting/fbo/get",
    { posting_number: postingNumber },
    postingSchema,
  );
  return {
    postingNumber: data.result.posting_number,
    status: data.result.status,
    updatedAt: data.result.in_process_at,
  };
}

export async function cancelOzonDeliveryOrder(
  orderNumber: string,
  reasonId: number,
): Promise<void> {
  await ozonDeliveryFetch(
    "/v1/order/cancel",
    { order_number: orderNumber, reason_id: reasonId },
    cancelOrderResponseSchema,
  );
}
