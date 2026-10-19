/**
 * Русские тексты для ошибок better-auth. Сервер отвечает по-английски
 * (`{ code, message }`), а формы показывают `error.message` как есть.
 */
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Неверный email или пароль.",
  INVALID_PASSWORD: "Неверный пароль.",
  INVALID_EMAIL: "Неверный email.",
  EMAIL_NOT_VERIFIED: "Сначала подтвердите email — ссылка в письме.",
  EMAIL_ALREADY_VERIFIED: "Email уже подтверждён.",
  EMAIL_MISMATCH: "Email не совпадает.",
  USER_NOT_FOUND: "Пользователь не найден.",
  USER_EMAIL_NOT_FOUND: "Email пользователя не найден.",
  USER_ALREADY_EXISTS: "Такой email уже зарегистрирован.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Такой email уже зарегистрирован. Войдите или укажите другой.",
  PASSWORD_TOO_SHORT: "Пароль слишком короткий.",
  PASSWORD_TOO_LONG: "Пароль слишком длинный.",
  PASSWORD_ALREADY_SET: "Пароль уже задан.",
  USER_ALREADY_HAS_PASSWORD: "Чтобы удалить аккаунт, введите пароль.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "У этого аккаунта нет пароля.",
  ACCOUNT_NOT_FOUND: "Аккаунт не найден.",
  INVALID_TOKEN: "Ссылка недействительна. Запросите новую.",
  TOKEN_EXPIRED: "Ссылка устарела. Запросите новую.",
  SESSION_EXPIRED: "Сессия устарела. Войдите заново.",
  SESSION_NOT_FRESH: "Сессия устарела. Войдите заново.",
  FAILED_TO_CREATE_USER: "Не удалось создать аккаунт.",
  FAILED_TO_CREATE_SESSION: "Не удалось войти.",
  FAILED_TO_UPDATE_USER: "Не удалось сохранить изменения.",
  FAILED_TO_GET_SESSION: "Не удалось проверить вход.",
  CHANGE_EMAIL_DISABLED: "Сменить email нельзя.",
  EMAIL_CAN_NOT_BE_UPDATED: "Сменить email нельзя.",
  VERIFICATION_EMAIL_NOT_ENABLED: "Подтверждение email отключено.",
  FAILED_TO_CREATE_VERIFICATION: "Не удалось отправить письмо.",
  VALIDATION_ERROR: "Проверьте введённые данные.",
  MISSING_FIELD: "Заполните все поля.",
  INVALID_OTP: "Неверный код.",
  OTP_EXPIRED: "Код устарел. Запросите новый.",
  TOO_MANY_ATTEMPTS: "Слишком много попыток. Запросите новый код.",
};

const TOO_MANY_REQUESTS = "Слишком много попыток. Подождите немного.";

/**
 * Текст ошибки better-auth по-русски. Неизвестная английская ошибка даёт
 * пустую строку — тогда форма покажет свой запасной текст.
 */
export function translateAuthError(error: {
  code?: unknown;
  message?: unknown;
  status?: number;
}): string {
  const code = typeof error.code === "string" ? error.code : "";
  const message = typeof error.message === "string" ? error.message : "";
  if (MESSAGES[code]) return MESSAGES[code];
  // Наши собственные ошибки (antispam) уже по-русски.
  if (/[а-яё]/i.test(message)) return message;
  if (error.status === 429) return TOO_MANY_REQUESTS;
  return "";
}

/**
 * `onResponse` для `fetchOptions` клиента better-auth: подменяет текст в
 * ответе с ошибкой, чтобы `error.message` везде был по-русски.
 */
export async function russifyAuthErrorResponse({
  response,
}: {
  response: Response;
}): Promise<Response | undefined> {
  if (response.ok) return;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return;
  }
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return;
  }
  if (!body || typeof body !== "object") return;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(
    JSON.stringify({
      ...body,
      message: translateAuthError({ ...body, status: response.status }),
    }),
    { status: response.status, statusText: response.statusText, headers },
  );
}
