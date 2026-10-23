import { randomUUID } from "node:crypto";
import { env } from "@/env";
import { kopecksToValue, type Payment } from "./payment";

export { kopecksToValue };

const API_BASE = "https://api.yookassa.ru/v3";

export interface YooKassaPayment extends Payment {
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
}

function authHeader(): string {
  const shopId = env.YOOKASSA_SHOP_ID;
  const secret = env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) {
    throw new Error("yookassa_not_configured");
  }
  return `Basic ${Buffer.from(`${shopId}:${secret}`).toString("base64")}`;
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
  // id приходит из тела вебхука: «../» не должен уводить запрос с ключами
  // магазина на другой путь API
  const res = await fetch(
    `${API_BASE}/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: { Authorization: authHeader() },
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`yookassa_get_failed_${res.status}: ${detail}`);
  }
  return (await res.json()) as YooKassaPayment;
}

export function isYooKassaConfigured(): boolean {
  return Boolean(env.YOOKASSA_SHOP_ID && env.YOOKASSA_SECRET_KEY);
}
