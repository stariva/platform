import type { ClientContext, RouterContractClient } from "@orpc/contract";
import { accountContract } from "./account";
import { adminContract } from "./admin";
import { checkoutContract } from "./checkout";
import { formsContract } from "./forms";
import { jobsContract } from "./jobs";
import { ordersContract } from "./orders";

export {
  FilesUnavailableError,
  LessonNotFoundError,
  LessonNotReleasedError,
  type LessonVideo,
  type LessonVideoResult,
  MaterialNotFoundError,
  type MaterialUrlResult,
  VideoNotUploadedError,
  VideoRateLimitedError,
} from "./account";
export {
  AdminNotConfiguredError,
  OzonNotConfiguredError,
  OzonRequestFailedError,
  type OzonStockPushResult,
} from "./admin";
export {
  CheckoutCheckFailedError,
  type CheckoutQuote,
  type CreatedOrder,
  type CreateOrderInput,
  DeliveryNotAvailableError,
  DeliveryUnavailableError,
  ItemsUnavailableError,
  MAX_MADE_TO_ORDER_LINES,
  MAX_MADE_TO_ORDER_QUANTITY,
  type MadeToOrderRequest,
  type MadeToOrderRequested,
  OptionsUnavailableError,
  type PhoneCheck,
  type QuoteInput,
} from "./checkout";
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
export {
  measurementEntrySchema,
  NothingToPayError,
  type OrderDetails,
  OrderDetailsLockedError,
  type OrderItem,
  OrderNotFoundError,
  type OrderPaymentStep,
  type OrderView,
  PaymentCreateFailedError,
  PaymentOverdueError,
  PaymentsUnavailableError,
} from "./orders";

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
  orders: ordersContract,
  checkout: checkoutContract,
};

export type WebContract = typeof webContract;

/** Клиент API витрины; `TContext` — контекст вызова для плагинов ссылки. */
export type WebClient<TContext extends ClientContext = Record<never, never>> =
  RouterContractClient<WebContract, TContext>;

/** Путь, по которому витрина отдаёт API (apps/web/src/app/api/rpc). */
export const WEB_RPC_PATH = "/api/rpc";
