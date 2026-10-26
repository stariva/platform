/** Общее для формы входа по коду и сервера better-auth. */

/** Цифр в коде из письма. */
export const SIGN_IN_CODE_LENGTH = 6;

/** Сколько живёт код из письма, в минутах. */
export const SIGN_IN_CODE_TTL_MINUTES = 10;

/** Неверных попыток на один код, после чего нужен новый. */
export const SIGN_IN_CODE_ATTEMPTS = 5;

/**
 * Путь, куда вернуть человека, если он войдёт кнопкой из письма, а не кодом.
 * Запрос кода (email-otp) принимает только email и тип, поэтому путь едет
 * заголовком.
 */
export const SIGN_IN_CALLBACK_HEADER = "x-stariva-sign-in-callback";

/**
 * Верный код для адреса без аккаунта: форма спрашивает имя и согласие на
 * обработку персональных данных и присылает тот же код ещё раз вместе с ними.
 */
export const PROFILE_REQUIRED = "PROFILE_REQUIRED";
