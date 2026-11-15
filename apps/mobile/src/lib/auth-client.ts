import { translateAuthError } from "@stariva/auth/errors";
import type { TokenStore } from "@/lib/token-store";

/**
 * Вход в аккаунт сайта из приложения: код из письма → bearer-токен.
 *
 * Запросы идут на `/api/auth` сайта без cookie (`credentials: "omit"`):
 * токен сессии сервер отдаёт заголовком `set-auth-token`, приложение хранит его
 * и шлёт как `Authorization: Bearer …` (см. `api.ts`). Регистрации в
 * приложении нет: аккаунт заводят на сайте, где берётся согласие на
 * обработку персональных данных.
 */

/** Заголовок с токеном формы (apps/web: form-token-shared.ts). */
const FORM_TOKEN_HEADER = "x-form-token";
/** Заголовок ответа с токеном сессии (плагин bearer). */
const SESSION_TOKEN_HEADER = "set-auth-token";
/** Код верный, а аккаунта нет (apps/web: sign-in-shared.ts). */
const PROFILE_REQUIRED = "PROFILE_REQUIRED";

/** Сервер не принимает токен формы моложе 2 секунд; берём с запасом. */
export const FORM_TOKEN_MIN_AGE_MS = 2_500;
/** Токен формы живёт 2 часа; обновляем заранее. */
const FORM_TOKEN_MAX_AGE_MS = 30 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export type CodeRequestResult = { ok: true } | { ok: false; message: string };

export type SignInResult =
  | { ok: true; user: SessionUser | null }
  | { ok: false; message: string; code?: string };

export type SessionCheck =
  | { status: "signed-in"; user: SessionUser }
  | { status: "signed-out" }
  /** Сервер недоступен: токен не трогаем, пользователя не выбрасываем. */
  | { status: "unknown" };

export interface AuthClientOptions {
  /** Адрес сайта; пусто — тот же адрес (браузер, dev-прокси). */
  baseUrl: string;
  tokens: TokenStore;
  /** Выдаёт токен формы (`forms.formToken` API сайта). */
  fetchFormToken: () => Promise<string>;
  fetch?: typeof fetch;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
}

const NETWORK_ERROR =
  "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";

interface ErrorBody {
  code?: unknown;
  message?: unknown;
}

export function createAuthClient(options: AuthClientOptions) {
  const { baseUrl, tokens, fetchFormToken } = options;
  const doFetch = options.fetch ?? ((...args) => fetch(...args));
  const now = options.now ?? Date.now;
  const wait =
    options.wait ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  let formToken: { value: string; at: number } | null = null;
  let formTokenLoading: Promise<void> | null = null;

  function endpoint(path: string): string {
    return baseUrl
      ? new URL(`/api/auth${path}`, baseUrl).href
      : `/api/auth${path}`;
  }

  /** Запрос без cookie, с токеном сессии, если он есть. */
  async function send(
    path: string,
    init: { method: "GET" | "POST"; body?: unknown; headers?: HeadersInit },
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    const token = await tokens.get();
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (init.body !== undefined)
      headers.set("content-type", "application/json");
    return doFetch(endpoint(path), {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "omit",
    });
  }

  async function failure(response: Response, fallback: string) {
    let body: ErrorBody = {};
    try {
      body = (await response.json()) as ErrorBody;
    } catch {
      // не JSON (прокси, 502) — покажем запасной текст
    }
    const code = typeof body.code === "string" ? body.code : undefined;
    const message =
      translateAuthError({
        code,
        message: body.message,
        status: response.status,
      }) || fallback;
    return { message, code };
  }

  /** Берёт токен формы заранее: к нажатию кнопки он уже «созрел». */
  function prepareFormToken(): Promise<void> {
    if (formToken && now() - formToken.at < FORM_TOKEN_MAX_AGE_MS) {
      return Promise.resolve();
    }
    formTokenLoading ??= fetchFormToken()
      .then((value) => {
        formToken = { value, at: now() };
      })
      .finally(() => {
        formTokenLoading = null;
      });
    return formTokenLoading;
  }

  async function readyFormToken(): Promise<string> {
    await prepareFormToken();
    const current = formToken;
    if (!current) throw new Error("form token missing");
    const age = now() - current.at;
    if (age < FORM_TOKEN_MIN_AGE_MS) await wait(FORM_TOKEN_MIN_AGE_MS - age);
    return current.value;
  }

  async function requestCode(email: string): Promise<CodeRequestResult> {
    try {
      for (let attempt = 0; ; attempt++) {
        const response = await send("/email-otp/send-verification-otp", {
          method: "POST",
          body: { email, type: "sign-in" },
          headers: { [FORM_TOKEN_HEADER]: await readyFormToken() },
        });
        if (response.ok) return { ok: true };
        const { message, code } = await failure(
          response,
          "Не удалось отправить код. Попробуйте ещё раз.",
        );
        // Токен формы устарел или «слишком свежий» — берём новый и пробуем раз
        if (code === "ANTISPAM" && attempt === 0 && response.status === 400) {
          formToken = null;
          continue;
        }
        return { ok: false, message };
      }
    } catch {
      return { ok: false, message: NETWORK_ERROR };
    }
  }

  async function signInWithCode(
    email: string,
    otp: string,
  ): Promise<SignInResult> {
    let response: Response;
    try {
      response = await send("/sign-in/email-otp", {
        method: "POST",
        body: { email, otp },
      });
    } catch {
      return { ok: false, message: NETWORK_ERROR };
    }

    if (!response.ok) {
      const { message, code } = await failure(
        response,
        "Не удалось проверить код. Попробуйте ещё раз.",
      );
      if (code === PROFILE_REQUIRED) {
        return {
          ok: false,
          code,
          message:
            "Для этого адреса ещё нет аккаунта. Создайте его на stariva.ru, а потом войдите здесь.",
        };
      }
      return { ok: false, message, code };
    }

    const token = response.headers.get(SESSION_TOKEN_HEADER);
    if (!token) {
      // Сайт без bearer-плагина или CORS не открыл заголовок — иначе не бывает
      return {
        ok: false,
        message:
          "Не удалось войти: сервер не выдал сессию. Обновите приложение.",
      };
    }
    await tokens.set(token);
    const body = (await response.json().catch(() => null)) as {
      user?: Partial<SessionUser>;
    } | null;
    return { ok: true, user: toUser(body?.user) };
  }

  /** Проверяет сохранённый токен на сервере. */
  async function checkSession(): Promise<SessionCheck> {
    if (!(await tokens.get())) return { status: "signed-out" };
    let response: Response;
    try {
      response = await send("/get-session", { method: "GET" });
    } catch {
      return { status: "unknown" };
    }
    // 5xx и прочие сбои — не повод разлогинивать
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        await tokens.clear();
        return { status: "signed-out" };
      }
      return { status: "unknown" };
    }
    const body = (await response.json().catch(() => undefined)) as
      | { user?: Partial<SessionUser> }
      | null
      | undefined;
    const user = toUser(body?.user);
    if (body === null && !user) {
      // better-auth отвечает 200 и null, когда сессии нет
      await tokens.clear();
      return { status: "signed-out" };
    }
    return user ? { status: "signed-in", user } : { status: "unknown" };
  }

  /** Выход: сессию гасим на сервере, токен у себя стираем в любом случае. */
  async function signOut(): Promise<void> {
    try {
      await send("/sign-out", { method: "POST", body: {} });
    } catch {
      // сети нет — сессия на сервере доживёт срок, но на устройстве её уже нет
    }
    await tokens.clear();
  }

  return {
    prepareFormToken,
    requestCode,
    signInWithCode,
    checkSession,
    signOut,
  };
}

export type AuthClient = ReturnType<typeof createAuthClient>;

function toUser(value: Partial<SessionUser> | undefined): SessionUser | null {
  if (!value || typeof value.id !== "string") return null;
  return {
    id: value.id,
    email: typeof value.email === "string" ? value.email : "",
    name: typeof value.name === "string" ? value.name : "",
  };
}
