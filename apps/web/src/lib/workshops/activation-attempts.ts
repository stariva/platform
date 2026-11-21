/**
 * Лимит неудачных попыток активации по IP. Отдельный модуль — общий шов для
 * кодов с маркетплейсов и Boosty, чтобы в тестах подменять только лимит.
 */
export {
  releaseActivationAttempt,
  reserveActivationAttempt,
} from "./access-codes";
