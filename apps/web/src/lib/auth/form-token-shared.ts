/** Заголовок, в котором форма присылает токен из /api/form-token. */
export const FORM_TOKEN_HEADER = "x-form-token";

/** Токен живёт 2 часа; вкладку, открытую надолго, обновляем заранее. */
export const FORM_TOKEN_REFRESH_MS = 30 * 60 * 1000;
