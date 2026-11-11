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
  MAX_REVIEW_PHOTO_BYTES,
  MAX_REVIEW_PHOTOS,
  MaterialNotFoundError,
  type MaterialUrlResult,
  ReviewPhotoInvalidError,
  ReviewUnavailableError,
  VideoNotUploadedError,
  VideoRateLimitedError,
  type WorkshopReview,
} from "./account";
export {
  AdminNotConfiguredError,
  type MadeToOrderParcel,
  madeToOrderParcelSchema,
  OzonNotConfiguredError,
  OzonRequestFailedError,
  type OzonStockPullResult,
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
  AnalyticsNotConfiguredError,
  AnalyticsPendingError,
  AttemptLostError,
  type EmailEventsSyncResult,
  JobsNotConfiguredError,
  PlaylistMissingError,
  type ReminderSweepResult,
  RemindersFailedError,
  StorageNotConfiguredError,
} from "./jobs";
export {
  DeliveryPointRequiredError,
  DeliveryPointUnavailableError,
  DeliveryQuoteFailedError,
  DeliveryQuoteUnavailableError,
  measurementEntrySchema,
  NothingToPayError,
  OrderDeliveryLockedError,
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
