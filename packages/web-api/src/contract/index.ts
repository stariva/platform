import type { ClientContext, RouterContractClient } from "@orpc/contract";
import { jobsContract } from "./jobs";

export {
  AttemptLostError,
  JobsNotConfiguredError,
  PlaylistMissingError,
  StorageNotConfiguredError,
} from "./jobs";

/**
 * Контракт API витрины (stariva.ru). Только схемы и ошибки, без реализации:
 * его импортируют клиенты (воркер apps/jobs, админка), которым не нужны ни
 * база, ни ключи витрины. Реализация — в `@stariva/web-api`.
 */
export const webContract = {
  jobs: jobsContract,
};

export type WebContract = typeof webContract;

/** Клиент API витрины; `TContext` — контекст вызова для плагинов ссылки. */
export type WebClient<TContext extends ClientContext = Record<never, never>> =
  RouterContractClient<WebContract, TContext>;

/** Путь, по которому витрина отдаёт API (apps/web/src/app/api/rpc). */
export const WEB_RPC_PATH = "/api/rpc";
