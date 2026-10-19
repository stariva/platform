import { createHash } from "node:crypto";
import { SELLER_INN } from "@stariva/config/seller";
import { env } from "@/env";

/**
 * Клиент «Мой налог» (lknpd.nalog.ru) — тот же API, которым пользуется
 * веб-кабинет самозанятого. Официального API для самих самозанятых у ФНС
 * нет, поэтому входим как кабинет: ИНН и пароль от личного кабинета.
 */
const API_BASE = "https://lknpd.nalog.ru/api/v1";
const TIMEOUT_MS = 15_000;

export interface NpdService {
  /** Название услуги или товара — так оно будет напечатано в чеке. */
  name: string;
  /** Цена за единицу в копейках. */
  amount: number;
  quantity: number;
}

/**
 * Чем кончился запрос в ФНС:
 * - `not_created` — ФНС отказала или до регистрации дохода не дошло: чека точно нет;
 * - `unknown` — ответа не дождались или сервис упал: чек мог появиться.
 */
export class NpdError extends Error {
  constructor(
    readonly outcome: "not_created" | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "NpdError";
  }
}

export function isNpdConfigured(): boolean {
  return Boolean(env.LKNPD_PASSWORD);
}

/** Слать ли чек покупателю сразу; иначе мастер отправляет его из админки. */
export function isNpdAutoEmail(): boolean {
  return env.LKNPD_AUTO_EMAIL;
}

// Один и тот же «браузер» при каждом входе, чтобы в кабинете не копились
// новые устройства после каждого перезапуска сайта
const deviceInfo = () => ({
  sourceDeviceId: createHash("sha256")
    .update(`stariva:${SELLER_INN}`)
    .digest("hex")
    .slice(0, 21),
  sourceType: "WEB",
  appVersion: "1.0.0",
  metaDetails: { userAgent: "Stariva" },
});

let session: { token: string; expiresAt: number } | null = null;

async function call(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; token?: string },
): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new NpdError(
      "unknown",
      error instanceof Error && error.name === "TimeoutError"
        ? `«Мой налог» не ответил за ${TIMEOUT_MS / 1000} с`
        : `нет соединения с «Мой налог»: ${String(error).slice(0, 120)}`,
    );
  }
}

/** Ошибка ответа: 4xx — отказ ФНС, чека нет, 5xx — сервис упал, исход неизвестен. */
async function failure(res: Response, what: string): Promise<NpdError> {
  const detail = (await res.text().catch(() => "")).slice(0, 300);
  return new NpdError(
    res.status < 500 ? "not_created" : "unknown",
    `${what}: ${res.status} ${detail}`.trim(),
  );
}

async function login(): Promise<string> {
  const password = env.LKNPD_PASSWORD;
  if (!password) throw new NpdError("not_created", "LKNPD_PASSWORD не задан");
  const res = await call("/auth/lkfl", {
    method: "POST",
    body: { username: SELLER_INN, password, deviceInfo: deviceInfo() },
  });
  if (!res.ok) throw await failure(res, "вход в «Мой налог»");
  const data = (await res.json()) as {
    token: string;
    tokenExpireIn?: string;
    profile?: { inn?: string };
  };
  if (data.profile?.inn && data.profile.inn !== SELLER_INN) {
    throw new NpdError(
      "not_created",
      `«Мой налог» пустил в кабинет другого ИНН: ${data.profile.inn}`,
    );
  }
  const expiresAt = data.tokenExpireIn
    ? Date.parse(data.tokenExpireIn)
    : Date.now() + 10 * 60_000;
  // Минута запаса, чтобы токен не истёк посреди запроса
  session = { token: data.token, expiresAt: expiresAt - 60_000 };
  return data.token;
}

/** Сбой входа — до регистрации дохода не дошло, значит чека точно нет. */
async function signIn(): Promise<string> {
  try {
    return await login();
  } catch (error) {
    if (error instanceof NpdError && error.outcome === "unknown") {
      throw new NpdError("not_created", error.message);
    }
    throw error;
  }
}

async function token(): Promise<string> {
  if (session && session.expiresAt > Date.now()) return session.token;
  return signIn();
}

/** Время в формате кабинета: с московским смещением, без миллисекунд. */
export function moscowTime(date: Date): string {
  const shifted = new Date(date.getTime() + 3 * 60 * 60_000);
  return `${shifted.toISOString().slice(0, 19)}+03:00`;
}

const rubles = (kopecks: number) => Number((kopecks / 100).toFixed(2));

/**
 * Регистрирует доход от физлица и возвращает номер чека. Повтор этого
 * запроса создаёт второй чек — защищаться от повторов должен вызывающий.
 */
export async function createIncome(input: {
  services: NpdService[];
  /** Когда пришли деньги — это время попадёт в чек. */
  operationTime: Date;
}): Promise<string> {
  const total = input.services.reduce(
    (sum, s) => sum + s.amount * s.quantity,
    0,
  );
  const body = {
    operationTime: moscowTime(input.operationTime),
    requestTime: moscowTime(new Date()),
    services: input.services.map((s) => ({
      name: s.name,
      amount: rubles(s.amount),
      quantity: s.quantity,
    })),
    totalAmount: (total / 100).toFixed(2),
    client: {
      contactPhone: null,
      displayName: null,
      inn: null,
      incomeType: "FROM_INDIVIDUAL",
    },
    paymentType: "CASH",
    ignoreMaxTotalIncomeRestriction: false,
  };

  let res = await call("/income", {
    method: "POST",
    body,
    token: await token(),
  });
  // Токен отозвали раньше срока — входим заново. 401 значит, что запрос
  // не приняли, так что повтор чек не задвоит
  if (res.status === 401) {
    session = null;
    res = await call("/income", {
      method: "POST",
      body,
      token: await signIn(),
    });
  }
  if (!res.ok) throw await failure(res, "регистрация дохода");
  const data = (await res.json().catch(() => null)) as {
    approvedReceiptUuid?: string;
  } | null;
  if (!data?.approvedReceiptUuid) {
    throw new NpdError("unknown", "«Мой налог» не вернул номер чека");
  }
  return data.approvedReceiptUuid.toLowerCase();
}

/** Ссылка на картинку чека — та же, что даёт «Поделиться» в «Мой налог». */
export function receiptPrintUrl(number: string): string {
  return `${API_BASE}/receipt/${SELLER_INN}/${number}/print`;
}

/** @internal Для тестов: забыть токен. */
export function resetNpdSession(): void {
  session = null;
}
