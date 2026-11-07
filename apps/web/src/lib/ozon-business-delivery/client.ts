import type { MadeToOrderParcel } from "@stariva/web-api/contract";
import { z } from "zod";
import { env } from "@/env";
import { normalizePhoneDigits } from "@/lib/phone";
import { OzonBusinessDeliveryError, ParcelNotApprovedError } from "./errors";

/**
 * Ozon Доставка для бизнеса (Delivery API): посылка без карточки товара и
 * остатков на Ozon. Отдельный кабинет и свои ключи, не путать с Seller API в
 * lib/ozon-delivery, через который идут заказы из наличия.
 * Описание методов: https://docs.ozon.ru/api/ozon-delivery/
 *
 * Пока не заданы все три OZON_BUSINESS_DELIVERY_*, кнопка мастера объясняет
 * это, а доплата выставляется с ручной стоимостью доставки.
 */
export function isOzonBusinessDeliveryConfigured(): boolean {
  return Boolean(
    env.OZON_BUSINESS_DELIVERY_CLIENT_ID &&
      env.OZON_BUSINESS_DELIVERY_CLIENT_SECRET &&
      env.OZON_BUSINESS_DELIVERY_SHIPMENT_METHOD_ID,
  );
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
  | {
      available: false;
      /** Для мастера: что не так и что делать. */
      reason?: string;
      /** `point` — не подходит выбранный пункт, покупателю достаточно выбрать другой. */
      cause?: "point";
    };

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

const API_ORIGIN = "https://api-delivery.ozon.ru";
const TOKEN_URL = "https://xapi.ozon.ru/oauth/token";
const SCOPES = [
  "delivery-api.delivery",
  "delivery-api.delivery-point",
  "delivery-api.order",
  "delivery-api.posting",
];
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 4;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
/** Ozon принимает запросы пачкой отправлений; мы шлём одно под этим номером. */
const REQUEST_ID = 1;
const JSON_HEADERS = { "Content-Type": "application/json" };

// Защита Ozon от DDoS (testcookie): на первый запрос сервер отвечает редиректом
// с Set-Cookie, и тот же запрос нужно повторить с этими cookie. Обычный fetch
// превратил бы POST в GET, поэтому редиректы ведём сами и cookie храним
// между запросами.
const cookies = new Map<string, Map<string, string>>();

function cookieHeader(host: string): string | undefined {
  const jar = cookies.get(host);
  if (!jar?.size) return undefined;
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function rememberCookies(host: string, res: Response) {
  const jar = cookies.get(host) ?? new Map<string, string>();
  for (const line of res.headers.getSetCookie()) {
    const pair = line.split(";", 1)[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  cookies.set(host, jar);
}

async function post(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<Response> {
  const origin = new URL(url).origin;
  let target = url;
  for (let hop = 0; ; hop++) {
    const host = new URL(target).host;
    const cookie = cookieHeader(host);
    const res = await fetch(target, {
      method: "POST",
      headers: cookie ? { ...headers, Cookie: cookie } : headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    rememberCookies(host, res);
    if (!REDIRECT_STATUSES.has(res.status)) return res;

    await res.body?.cancel().catch(() => {});
    const location = res.headers.get("location");
    const next = location ? new URL(location, target) : null;
    // С токеном и телом запроса идём только на тот же адрес Ozon
    if (!next || next.origin !== origin || hop >= MAX_REDIRECTS) {
      throw new Error(
        `ozon_business_delivery_unexpected_redirect_${res.status}`,
      );
    }
    target = next.toString();
  }
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.coerce.number().positive(),
});

let token: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;

/** Сбрасывает токен и cookie: нужен тестам, в работе не вызывается. */
export function resetOzonBusinessSession() {
  token = null;
  tokenRequest = null;
  cookies.clear();
}

async function fetchToken(): Promise<string> {
  const clientId = env.OZON_BUSINESS_DELIVERY_CLIENT_ID;
  const clientSecret = env.OZON_BUSINESS_DELIVERY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("ozon_business_delivery_not_configured");
  }
  const res = await post(
    TOKEN_URL,
    JSON_HEADERS,
    JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope: SCOPES,
    }),
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `ozon_business_delivery_oauth_failed_${res.status}: ${detail.slice(0, 300)}`,
    );
  }
  const data = tokenSchema.parse(await res.json());
  // Обновляем чуть раньше срока, чтобы не поймать 401 посреди запроса
  token = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(data.expires_in - 60, 30) * 1000,
  };
  return data.access_token;
}

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now()) return token.value;
  // Одновременные запросы ждут один и тот же обмен ключей
  tokenRequest ??= fetchToken().finally(() => {
    tokenRequest = null;
  });
  return tokenRequest;
}

async function call<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const payload = JSON.stringify(body);
  for (let attempt = 0; ; attempt++) {
    const res = await post(
      `${API_ORIGIN}${path}`,
      { ...JSON_HEADERS, Authorization: `Bearer ${await accessToken()}` },
      payload,
    );
    // Токен могли отозвать раньше срока: один раз берём новый
    if (res.status === 401 && attempt === 0) {
      token = null;
      await res.body?.cancel().catch(() => {});
      continue;
    }
    const text = await res.text();
    if (!res.ok)
      throw OzonBusinessDeliveryError.fromResponse(path, res.status, text);
    return schema.parse(text ? JSON.parse(text) : {});
  }
}

const moneySchema = z.object({
  amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
});
const resultErrorSchema = z.object({
  code: z.string().nullish(),
  message: z.string(),
});
const checkClientSchema = z.object({ can_be_delivered: z.boolean() });
const checkoutSchema = z.object({
  results: z.array(
    z.object({
      request_id: z.number(),
      posting: z
        .object({
          estimated_delivery_cost: moneySchema,
          estimated_insurance_cost: moneySchema,
        })
        .nullish(),
      error: resultErrorSchema.nullish(),
    }),
  ),
});
// У подтверждения в спецификации нет тела ответа: успех — это 200, а любой
// объект (в том числе пустой) принимаем, остальное считаем сбоем
const approveSchema = z.object({});
const createSchema = z.object({
  order_number: z.string().min(1),
  postings: z.array(z.object({ posting_number: z.string().min(1) })),
});

/** «1250.50» → 125050 копеек; без плавающей точки. */
function toKopecks(amount: string): number {
  const [rubles = "0", fraction = ""] = amount.split(".");
  return Number(rubles) * 100 + Number(fraction.padEnd(2, "0"));
}

/** 125050 копеек → «1250.50». */
function toAmount(kopecks: number): string {
  const rubles = Math.floor(kopecks / 100);
  return `${rubles}.${String(kopecks % 100).padStart(2, "0")}`;
}

/** «+79001234567»; Ozon доставляет по российским номерам. */
function ozonPhone(phone: string): string | null {
  const digits = normalizePhoneDigits(phone);
  return /^7\d{10}$/.test(digits) ? `+${digits}` : null;
}

function pointNumber(pointId: string): number | null {
  const id = Number(pointId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function shipmentMethodId(): number {
  const id = env.OZON_BUSINESS_DELIVERY_SHIPMENT_METHOD_ID;
  if (!id) throw new Error("ozon_business_delivery_not_configured");
  return id;
}

function postingPayload(request: ParcelRequest) {
  const { parcel } = request;
  return {
    request_id: REQUEST_ID,
    shipment_method_id: shipmentMethodId(),
    declared_value: {
      amount: toAmount(request.declaredValueKopecks),
      currency_code: "RUB",
    },
    dimensions: {
      weight_g: parcel.weightGrams,
      length_mm: parcel.lengthCm * 10,
      width_mm: parcel.widthCm * 10,
      height_mm: parcel.heightCm * 10,
    },
  };
}

const MANUAL_HINT = "Можно указать стоимость вручную";

// Мастер видит эти тексты в админке, поэтому про то, что делать дальше
const REFUSALS: Record<string, string> = {
  RecipientError:
    "Ozon не сможет доставить заказ этому покупателю: проверьте его телефон",
  DeliveryPointRestrictionsError:
    "Пункт не принимает такую посылку: проверьте вес, размеры и стоимость",
  DeliveryPointNotFound:
    "Ozon не нашёл этот пункт выдачи: попросите покупателя выбрать другой",
  SameDeliveryPointError:
    "Пункт выдачи совпадает с пунктом отгрузки: покупателю нужен другой пункт",
  SamePointError:
    "Пункт выдачи совпадает с пунктом отгрузки: покупателю нужен другой пункт",
  DeliveryAvailabilityError: "Ozon не смог рассчитать доставку до этого пункта",
  DeliveryCalculationError: "Ozon не смог рассчитать доставку до этого пункта",
  PrincipalError:
    "Кабинет Ozon Доставки заблокирован: напишите в поддержку Ozon",
};

// Отказы из-за пункта: покупатель решает их сам, выбрав другой
const POINT_REFUSALS = new Set([
  "DeliveryPointRestrictionsError",
  "DeliveryPointNotFound",
  "SameDeliveryPointError",
  "SamePointError",
  "DeliveryAvailabilityError",
]);

function refusal(error?: { code?: string | null; message: string } | null) {
  const reason =
    (error?.code && REFUSALS[error.code]) ||
    error?.message ||
    "Ozon не доставит такую посылку в этот пункт";
  return {
    available: false as const,
    reason: `${reason}. ${MANUAL_HINT}`,
    ...(error?.code && POINT_REFUSALS.has(error.code)
      ? { cause: "point" as const }
      : {}),
  };
}

/**
 * Условия доставки посылки до пункта: стоимость перевозки со страховкой. Заказ
 * в Ozon не создаёт. Отказ Ozon возвращает с причиной для мастера, а сбой связи
 * или ключей бросает ошибкой.
 */
export async function quoteParcel(
  request: ParcelRequest,
): Promise<ParcelQuote> {
  const phone = ozonPhone(request.recipientPhone);
  if (!phone) {
    return {
      available: false,
      reason: `Телефон покупателя не похож на российский номер: поправьте его в заказе. ${MANUAL_HINT}`,
    };
  }
  const pointId = pointNumber(request.pointId);
  if (!pointId) {
    return {
      available: false,
      reason: `Пункт выдачи сохранён с ошибкой: попросите покупателя выбрать его заново. ${MANUAL_HINT}`,
    };
  }

  // Ozon доставляет только тем, кто зарегистрирован в Ozon
  const client = await call(
    "/v1/delivery/check-client",
    { phone_number: phone },
    checkClientSchema,
  );
  if (!client.can_be_delivered) {
    return {
      available: false,
      reason: `Покупателя с этим телефоном нет в Ozon: пусть зарегистрируется в приложении Ozon. ${MANUAL_HINT}`,
    };
  }

  const checked = await call(
    "/v1/order/checkout",
    {
      recipient: { phone_number: phone },
      postings: [postingPayload(request)],
      delivery: { delivery_point: { delivery_point_id: pointId } },
    },
    checkoutSchema,
  );
  const result = checked.results.find((row) => row.request_id === REQUEST_ID);
  if (!result)
    throw new Error("ozon_business_delivery_checkout_without_result");
  if (result.error || !result.posting) return refusal(result.error);

  return {
    available: true,
    priceKopecks:
      toKopecks(result.posting.estimated_delivery_cost.amount) +
      toKopecks(result.posting.estimated_insurance_cost.amount),
  };
}

/** Что лежит в посылке: названия изделий, не длиннее 500 знаков. */
function contents(items: CreateParcelRequest["items"]): string {
  const text = items
    .map((item) => `${item.name} × ${item.quantity}`)
    .join(", ");
  return (text || "Изделие ручной работы").slice(0, 500);
}

/**
 * Создаёт заказ и подтверждает отправление к отгрузке: у Ozon это два шага, и
 * подтверждение требует положительного баланса кабинета доставки. Если заказ
 * создан, а подтвердить не вышло, бросает ParcelNotApprovedError с номерами:
 * такой заказ уже есть в Ozon, второй создавать нельзя.
 */
export async function createParcelShipment(
  request: CreateParcelRequest,
): Promise<CreatedParcel> {
  const phone = ozonPhone(request.recipientPhone);
  const pointId = pointNumber(request.pointId);
  if (!phone) throw new Error("ozon_business_delivery_invalid_phone");
  if (!pointId) throw new Error("ozon_business_delivery_invalid_pickup_point");

  const created = await call(
    "/v1/order/create",
    {
      order_external_id: request.externalOrderId,
      recipient: { phone_number: phone, full_name: request.recipientName },
      delivery: { delivery_point: { delivery_point_id: pointId } },
      postings: [
        {
          ...postingPayload(request),
          posting_external_id: request.externalOrderId,
          description: contents(request.items),
        },
      ],
    },
    createSchema,
  );
  const parcel: CreatedParcel = {
    orderId: created.order_number,
    postingNumbers: created.postings.map((posting) => posting.posting_number),
  };
  if (parcel.postingNumbers.length === 0) {
    throw new Error("ozon_business_delivery_order_without_postings");
  }

  try {
    for (const postingNumber of parcel.postingNumbers) {
      await call(
        "/v1/posting/approve",
        { posting_number: postingNumber },
        approveSchema,
      );
    }
  } catch (error) {
    throw new ParcelNotApprovedError(parcel, error);
  }
  return parcel;
}
