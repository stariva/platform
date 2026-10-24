import { hatchet } from "../client";
import { webApi } from "../lib/web-api";

/**
 * Каждое утро забирает к себе Метрику и Директ для анализа покупателей:
 * цели и сырые визиты и события Метрики за неделю (Logs API), статистику
 * Директа по срезам и поисковые запросы за две недели (Reports API).
 *
 * Работу делает сайт (jobs.analytics.*), воркер только задаёт порядок: цели
 * нужны раньше Директа, по ним считаются конверсии. Яндекс готовит выгрузки
 * асинхронно; не успел — сайт отвечает ANALYTICS_PENDING, и Hatchet
 * повторяет задание через несколько минут, подхватывая тот же запрос.
 * Повторы безопасны: визиты перезаписываются по id, статистика за дни —
 * целиком.
 */
export const yandexAnalyticsSyncWorkflow = hatchet.workflow({
  name: "yandex-analytics-sync",
  // 07:20 по Москве: вчерашние логи Метрики уже готовы
  on: { cron: "20 4 * * *" },
});

const retry = {
  retries: 6,
  backoff: { factor: 2, maxSeconds: 900 },
  executionTimeout: "300s",
} as const;
const timeout = { context: { timeout: 290_000 } };

const goals = yandexAnalyticsSyncWorkflow.task({
  name: "metrika-goals",
  ...retry,
  fn: () => webApi.jobs.analytics.metrikaGoals(undefined, timeout),
});

yandexAnalyticsSyncWorkflow.task({
  name: "metrika-visits",
  parents: [goals],
  ...retry,
  fn: () => webApi.jobs.analytics.metrikaLogs({ source: "visits" }, timeout),
});

yandexAnalyticsSyncWorkflow.task({
  name: "metrika-hits",
  parents: [goals],
  ...retry,
  fn: () => webApi.jobs.analytics.metrikaLogs({ source: "hits" }, timeout),
});

yandexAnalyticsSyncWorkflow.task({
  name: "direct-stats",
  parents: [goals],
  ...retry,
  fn: () => webApi.jobs.analytics.directReport({ report: "stats" }, timeout),
});

yandexAnalyticsSyncWorkflow.task({
  name: "direct-search-queries",
  parents: [goals],
  ...retry,
  fn: () =>
    webApi.jobs.analytics.directReport({ report: "search_queries" }, timeout),
});
