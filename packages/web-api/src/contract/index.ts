import type { ClientContext, RouterContractClient } from "@orpc/contract";
import { accountContract } from "./account";
import { adminContract } from "./admin";
import { formsContract } from "./forms";
import { jobsContract } from "./jobs";

export { LessonNotFoundError } from "./account";
export {
  AdminNotConfiguredError,
  OzonNotConfiguredError,
  OzonRequestFailedError,
  type OzonStockPushResult,
} from "./admin";
export {
  CustomOrderConflictError,
  type CustomOrderRequest,
  CustomOrderSaveFailedError,
  CustomOrderUnavailableError,
  customOrderRequestSchema,
  MAX_ORDER_PHOTO_BYTES,
  NewsletterFailedError,
} from "./forms";
export {
  AttemptLostError,
  JobsNotConfiguredError,
  PlaylistMissingError,
  type ReminderSweepResult,
  RemindersFailedError,
  StorageNotConfiguredError,
} from "./jobs";

/**
 * Контракт API витрины (stariva.ru). Только схемы и ошибки, без реализации:
 * его импортируют клиенты (воркер apps/jobs, админка, браузер), которым не нужны ни
 * база, ни ключи витрины. Реализация — в `@stariva/web-api`.
 */
export const webContract = {
  jobs: jobsContract,
  admin: adminContract,
  account: accountContract,
  forms: formsContract,
};

export type WebContract = typeof webContract;

/** Клиент API витрины; `TContext` — контекст вызова для плагинов ссылки. */
export type WebClient<TContext extends ClientContext = Record<never, never>> =
  RouterContractClient<WebContract, TContext>;

/** Путь, по которому витрина отдаёт API (apps/web/src/app/api/rpc). */
export const WEB_RPC_PATH = "/api/rpc";
