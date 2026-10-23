import { npdIssuingWatchWorkflow } from "./npd-issuing-watch";
import { workshopRemindersWorkflow } from "./workshop-reminders";
import { workshopStorageSweepWorkflow } from "./workshop-storage-sweep";

/**
 * Все задания воркера Hatchet. Новое задание — файл рядом и строка здесь.
 * Нарезка HLS живёт в Trigger.dev (src/trigger).
 */
export const workflows = [
  workshopRemindersWorkflow,
  npdIssuingWatchWorkflow,
  workshopStorageSweepWorkflow,
];
