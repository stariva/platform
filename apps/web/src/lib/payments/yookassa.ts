import { randomUUID } from "node:crypto";
import { env } from "@/env";

const API_BASE = "https://api.yookassa.ru/v3";

export interface YooKassaAmount {
  value: string; // "1490.00"
  currency: string; // "RUB"
}

export interface YooKassaPayment {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: YooKassaAmount;
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
  metadata?: Record<string, string>;
}

function authHeader(): string {
  const shopId = env.YOOKASSA_SHOP_ID;
  const secret = env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) {
    throw new Error("yookassa_not_configured");
  }
  return `Basic ${Buffer.from(`${shopId}:${secret}`).toString("base64")}`;
}

/** Сумма в копейках → строка "1490.00" для YooKassa. */
export function kopecksToValue(kopecks: number): string {
  return (kopecks / 100).toFixed(2);
}

interface CreatePaymentInput {
  amountKopecks: number;
  description: string;
  returnUrl: string;
  metadata: Record<string, string>;
  /** Ключ идемпотентности — повторный запрос с тем же ключом не создаст дубль. */
  idempotenceKey?: string;
}

/** Создаёт платёж в YooKassa и возвращает данные с confirmation_url. */
export async function createPayment(
  input: CreatePaymentInput,
): Promise<YooKassaPayment> {
  const res = await fetch(`${API_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      "Idempotence-Key": input.idempotenceKey ?? randomUUID(),
    },
    body: JSON.stringify({
      amount: {
        value: kopecksToValue(input.amountKopecks),
        currency: "RUB",
      },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: input.returnUrl,
      },
      description: input.description,
      metadata: input.metadata,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`yookassa_create_failed_${res.status}: ${detail}`);
  }
  return (await res.json()) as YooKassaPayment;
}

/**
 * Запрашивает актуальный статус платежа в YooKassa.
 * Используется в вебхуке для подтверждения подлинности уведомления.
 */
export async function getPayment(paymentId: string): Promise<YooKassaPayment> {
  const res = await fetch(`${API_BASE}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`yookassa_get_failed_${res.status}: ${detail}`);
  }
  return (await res.json()) as YooKassaPayment;
}

export function isYooKassaConfigured(): boolean {
  return Boolean(env.YOOKASSA_SHOP_ID && env.YOOKASSA_SECRET_KEY);
}
