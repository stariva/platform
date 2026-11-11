import { emailEventsWorkflow } from "./email-events";
import { npdIssuingWatchWorkflow } from "./npd-issuing-watch";
import { ozonStockSyncWorkflow } from "./ozon-stock-sync";
import { workshopRemindersWorkflow } from "./workshop-reminders";
import { workshopStorageSweepWorkflow } from "./workshop-storage-sweep";
import { yandexAnalyticsSyncWorkflow } from "./yandex-analytics-sync";

/**
 * Все задания воркера Hatchet. Новое задание — файл рядом и строка здесь.
 * Нарезка HLS живёт в Trigger.dev (src/trigger).
 */
export const workflows = [
  workshopRemindersWorkflow,
  npdIssuingWatchWorkflow,
  workshopStorageSweepWorkflow,
  yandexAnalyticsSyncWorkflow,
  emailEventsWorkflow,
  ozonStockSyncWorkflow,
];
