import type { ContractRouterClient } from "@orpc/contract";
import { jobsContract } from "./jobs";

/**
 * Контракт API витрины (stariva.ru). Только схемы, без реализации: его
 * импортируют клиенты (воркер apps/jobs, админка), которым не нужны ни
 * база, ни ключи витрины. Реализация — в `@stariva/web-api`.
 */
export const webContract = {
  jobs: jobsContract,
};

export type WebContract = typeof webContract;
export type WebClient = ContractRouterClient<WebContract>;

/** Путь, по которому витрина отдаёт API (apps/web/src/app/api/rpc). */
export const WEB_RPC_PATH = "/api/rpc";
