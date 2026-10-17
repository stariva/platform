import { COMMON_ERROR_STATUS_MAP } from "@orpc/server";
import {
  AdminNotConfiguredError,
  AttemptLostError,
  CheckoutCheckFailedError,
  CustomOrderConflictError,
  CustomOrderSaveFailedError,
  CustomOrderUnavailableError,
  DeliveryNotAvailableError,
  DeliveryUnavailableError,
  FilesUnavailableError,
  ItemsUnavailableError,
  JobsNotConfiguredError,
  LessonNotFoundError,
  LessonNotReleasedError,
  MaterialNotFoundError,
  NewsletterFailedError,
  NothingToPayError,
  OptionsUnavailableError,
  OrderDetailsLockedError,
  OrderNotFoundError,
  OzonNotConfiguredError,
  OzonRequestFailedError,
  PaymentCreateFailedError,
  PaymentOverdueError,
  PaymentsUnavailableError,
  PlaylistMissingError,
  RemindersFailedError,
  StorageNotConfiguredError,
  VideoNotUploadedError,
  VideoRateLimitedError,
} from "./contract";

/**
 * HTTP-статусы для своих кодов ошибок: в v2 статус задаёт обработчик, а не
 * ошибка. Клиенты различают ошибки по коду, статус нужен логам и прокси.
 */
export const webErrorStatusMap = {
  ...COMMON_ERROR_STATUS_MAP,
  [JobsNotConfiguredError.code]: 503,
  [StorageNotConfiguredError.code]: 503,
  [AttemptLostError.code]: 409,
  [PlaylistMissingError.code]: 409,
  // Прогон не дослал часть уведомлений: воркер повторит его целиком
  [RemindersFailedError.code]: 500,
  [AdminNotConfiguredError.code]: 503,
  [OzonNotConfiguredError.code]: 503,
  [OzonRequestFailedError.code]: 502,
  [LessonNotFoundError.code]: 404,
  [VideoNotUploadedError.code]: 404,
  [LessonNotReleasedError.code]: 403,
  [VideoRateLimitedError.code]: 429,
  [FilesUnavailableError.code]: 503,
  [MaterialNotFoundError.code]: 404,
  [NewsletterFailedError.code]: 502,
  [CustomOrderUnavailableError.code]: 503,
  [CustomOrderConflictError.code]: 409,
  [CustomOrderSaveFailedError.code]: 503,
  [OrderNotFoundError.code]: 404,
  [OrderDetailsLockedError.code]: 409,
  [PaymentsUnavailableError.code]: 503,
  [NothingToPayError.code]: 409,
  [PaymentOverdueError.code]: 409,
  [PaymentCreateFailedError.code]: 502,
  [DeliveryUnavailableError.code]: 503,
  [DeliveryNotAvailableError.code]: 400,
  [ItemsUnavailableError.code]: 409,
  [OptionsUnavailableError.code]: 400,
  [CheckoutCheckFailedError.code]: 502,
} satisfies Record<string, number>;

/** Коды ошибок, для которых у API витрины есть свой HTTP-статус. */
export type WebErrorCode = keyof typeof webErrorStatusMap;

function isWebErrorCode(code: string): code is WebErrorCode {
  return Object.hasOwn(webErrorStatusMap, code);
}

/** HTTP-статус ошибки с этим кодом; незнакомый код — 500, как у обработчика. */
export function webErrorStatus(code: string): number {
  return isWebErrorCode(code) ? webErrorStatusMap[code] : 500;
}
