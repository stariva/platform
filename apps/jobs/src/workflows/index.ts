import { emailEventsWorkflow } from "./email-events";
import { madeToOrderDeliveryWorkflow } from "./made-to-order-delivery";
import { npdIssuingWatchWorkflow } from "./npd-issuing-watch";
import { ozonPvzSyncWorkflow } from "./ozon-pvz-sync";
import { ozonStockSyncWorkflow } from "./ozon-stock-sync";
import { pagespeedScanWorkflow } from "./pagespeed-scan";
import { workshopRemindersWorkflow } from "./workshop-reminders";
import { workshopStorageMirrorWorkflow } from "./workshop-storage-mirror";
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
  workshopStorageMirrorWorkflow,
  yandexAnalyticsSyncWorkflow,
  emailEventsWorkflow,
  ozonStockSyncWorkflow,
  ozonPvzSyncWorkflow,
  madeToOrderDeliveryWorkflow,
  pagespeedScanWorkflow,
];
