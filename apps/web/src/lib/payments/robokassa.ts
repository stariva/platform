import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@stariva/db";
import { robokassaInvoices } from "@stariva/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { env } from "@/env";
import { kopecksToValue, type Payment } from "./payment";

const PAY_URL = "https://auth.robokassa.ru/Merchant/Index.aspx";
const STATE_URL =
  "https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt";
const PAYMENT_ID_PREFIX = "robokassa:";

/**
 * Способы оплаты на странице Robokassa — Alias из GetCurrencies. Карты и СБП
 * идут через ЮKassa: в Robokassa они дороже.
 */
const PAYMENT_METHODS = ["YandexPay", "YandexPaySplit"];

export type RobokassaInvoice = typeof robokassaInvoices.$inferSelect;

/** К какому заказу выставлен счёт. */
export type InvoiceTarget =
  | { kind: "workshop"; orderId: string }
  | { kind: "product"; orderId: string };

export function isRobokassaConfigured(): boolean {
  return Boolean(
    env.ROBOKASSA_LOGIN && env.ROBOKASSA_PASSWORD_1 && env.ROBOKASSA_PASSWORD_2,
  );
}

function config() {
  const login = env.ROBOKASSA_LOGIN;
  const password1 = env.ROBOKASSA_PASSWORD_1;
  const password2 = env.ROBOKASSA_PASSWORD_2;
  if (!login || !password1 || !password2) {
    throw new Error("robokassa_not_configured");
  }
  return { login, password1, password2 };
}

/** Подпись Robokassa: части через двоеточие, хеш в hex. */
export function signature(parts: string[]): string {
  return createHash(env.ROBOKASSA_HASH).update(parts.join(":")).digest("hex");
}

/** Пользовательские Shp_* по алфавиту в виде «Shp_key=value» для подписи. */
function shpParts(params: URLSearchParams): string[] {
  return [...params.entries()]
    .filter(([key]) => key.startsWith("Shp_"))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`);
}

/** Подписи в hex сравниваем без учёта регистра: Robokassa шлёт заглавные. */
function sameSignature(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase());
  const right = Buffer.from(b.toLowerCase());
  return left.length === right.length && timingSafeEqual(left, right);
}

export function robokassaPaymentId(invoiceId: number): string {
  return `${PAYMENT_ID_PREFIX}${invoiceId}`;
}

/** Номер счёта из paymentId заказа; null — платёж ЮKassa. */
export function parseRobokassaPaymentId(paymentId: string): number | null {
  if (!paymentId.startsWith(PAYMENT_ID_PREFIX)) return null;
  const id = Number(paymentId.slice(PAYMENT_ID_PREFIX.length));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Description у Robokassa — до 100 символов «без спецсимволов»: оставляем
 * буквы, цифры и простую пунктуацию, кавычки-ёлочки и тире заменяем.
 */
export function invoiceDescription(text: string): string {
  return text
    .replace(/[—–]/g, "-")
    .replace(/[^\p{L}\p{N} .,:;№()-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)
    .trim();
}

/** Заводит счёт: его номер станет InvId платежа. */
export async function createInvoice(
  target: InvoiceTarget,
  amountKopecks: number,
): Promise<RobokassaInvoice> {
  const [invoice] = await db
    .insert(robokassaInvoices)
    .values({
      amount: amountKopecks,
      productOrderId: target.kind === "product" ? target.orderId : null,
      workshopOrderId: target.kind === "workshop" ? target.orderId : null,
    })
    .returning();
  if (!invoice) throw new Error("robokassa_invoice_insert_failed");
  return invoice;
}

export async function getInvoice(
  invoiceId: number,
): Promise<RobokassaInvoice | null> {
  const [invoice] = await db
    .select()
    .from(robokassaInvoices)
    .where(eq(robokassaInvoices.id, invoiceId))
    .limit(1);
  return invoice ?? null;
}

/** Отмечает оплату счёта. Идемпотентно: повтор не меняет paidAt. */
export async function markInvoicePaid(
  invoiceId: number,
  paymentMethod: string | null,
): Promise<RobokassaInvoice | null> {
  await db
    .update(robokassaInvoices)
    .set({ paidAt: new Date(), paymentMethod })
    .where(
      and(
        eq(robokassaInvoices.id, invoiceId),
        isNull(robokassaInvoices.paidAt),
      ),
    );
  return getInvoice(invoiceId);
}

export function invoiceTarget(invoice: RobokassaInvoice): InvoiceTarget {
  if (invoice.workshopOrderId) {
    return { kind: "workshop", orderId: invoice.workshopOrderId };
  }
  if (invoice.productOrderId) {
    return { kind: "product", orderId: invoice.productOrderId };
  }
  // Ограничение robokassa_invoices_one_order не даёт сюда попасть
  throw new Error(`robokassa_invoice_without_order:${invoice.id}`);
}

/**
 * Ссылка на страницу оплаты Robokassa с выбором Яндекс Пэй или Сплита.
 * Email покупателя не передаём: ссылка — GET, а адрес не должен оседать
 * в логах. Robokassa спросит его сама, чек мы отправляем свой.
 * `extra` уходит пользовательскими Shp_*: Robokassa хранит их с платежом
 * и возвращает в уведомлениях — как metadata у ЮKassa.
 */
export function paymentUrl(
  invoice: RobokassaInvoice,
  description: string,
  extra: Record<string, string> = {},
): string {
  const { login, password1 } = config();
  const outSum = kopecksToValue(invoice.amount);
  const shp = new URLSearchParams(
    Object.entries(extra).map(([key, value]) => [`Shp_${key}`, value]),
  );
  const params = new URLSearchParams({
    MerchantLogin: login,
    OutSum: outSum,
    InvId: String(invoice.id),
    Description: invoiceDescription(description),
    SignatureValue: signature([
      login,
      outSum,
      String(invoice.id),
      password1,
      ...shpParts(shp),
    ]),
    Culture: "ru",
  });
  for (const [key, value] of shp) params.set(key, value);
  for (const method of PAYMENT_METHODS) params.append("PaymentMethods", method);
  if (env.ROBOKASSA_TEST) params.set("IsTest", "1");
  return `${PAY_URL}?${params}`;
}

/**
 * Проверяет подпись уведомления на Result URL: OutSum:InvId:Пароль#2 и
 * пользовательские Shp_* по алфавиту. OutSum берём строкой как пришёл —
 * Robokassa подписывает его в своём формате («1490.000000»).
 */
export function verifyResultSignature(params: URLSearchParams): boolean {
  const { password2 } = config();
  const outSum = params.get("OutSum");
  const invId = params.get("InvId");
  const received = params.get("SignatureValue");
  if (!outSum || !invId || !received) return false;
  const expected = signature([outSum, invId, password2, ...shpParts(params)]);
  return sameSignature(expected, received);
}

/** OutSum Robokassa («1490.000000») → копейки. */
export function outSumToKopecks(outSum: string): number | null {
  const value = Number(outSum);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/**
 * Счёт в виде общего платежа для обработки заказа. Сумма — наша из счёта:
 * она подписана при переходе на оплату, и покупатель её не изменит.
 */
export function invoicePayment(
  invoice: RobokassaInvoice,
  status: Payment["status"],
): Payment {
  const target = invoiceTarget(invoice);
  return {
    id: robokassaPaymentId(invoice.id),
    status,
    paid: status === "succeeded",
    amount: { value: kopecksToValue(invoice.amount), currency: "RUB" },
    created_at: invoice.createdAt.toISOString(),
    captured_at: invoice.paidAt?.toISOString(),
    metadata: {
      orderId: target.orderId,
      kind: target.kind,
      invoiceId: String(invoice.id),
    },
  };
}

/** Первое значение тега в XML-ответе Robokassa внутри родителя. */
function xmlCode(xml: string, parent: string): number | null {
  const match = new RegExp(`<${parent}>[\\s\\S]*?<Code>(-?\\d+)</Code>`).exec(
    xml,
  );
  return match?.[1] ? Number(match[1]) : null;
}

/**
 * Состояние счёта из OpStateExt → статус платежа. 100 — деньги зачислены;
 * 10 — отменён или истёк, 60 — деньги вернули покупателю; остальное
 * (5 — начат, 20 — холд, 50 — зачисляется, 80 — на проверке) ещё в пути.
 */
export function stateToStatus(state: number): Payment["status"] {
  if (state === 100) return "succeeded";
  if (state === 10 || state === 60) return "canceled";
  return "pending";
}

/**
 * Актуальный статус счёта. Оплату, отмеченную уведомлением, не перепроверяем.
 * OpStateExt не видит тестовых платежей: в тесте статус приходит только
 * уведомлением на Result URL.
 */
export async function getRobokassaPayment(
  invoiceId: number,
): Promise<Payment | null> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) return null;
  if (invoice.paidAt) return invoicePayment(invoice, "succeeded");
  if (env.ROBOKASSA_TEST) return invoicePayment(invoice, "pending");

  const { login, password2 } = config();
  const params = new URLSearchParams({
    MerchantLogin: login,
    InvoiceID: String(invoice.id),
    Signature: signature([login, String(invoice.id), password2]),
  });
  const res = await fetch(`${STATE_URL}?${params}`);
  if (!res.ok) {
    throw new Error(`robokassa_state_failed_${res.status}`);
  }
  const xml = await res.text();
  const result = xmlCode(xml, "Result");
  // 3 — операции ещё нет: покупатель не дошёл до оплаты
  if (result === 3) return invoicePayment(invoice, "pending");
  if (result !== 0) {
    throw new Error(`robokassa_state_result_${result ?? "unknown"}`);
  }
  const state = xmlCode(xml, "State");
  if (state === null) throw new Error("robokassa_state_without_code");
  const status = stateToStatus(state);
  if (status !== "succeeded") return invoicePayment(invoice, status);
  // Уведомление потерялось или опаздывает — отмечаем оплату сами
  const paid = await markInvoicePaid(invoice.id, null);
  return invoicePayment(paid ?? invoice, "succeeded");
}
