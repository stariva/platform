/**
 * Разовая догрузка истории Метрики и Директа: ежедневное задание
 * (yandex-analytics-sync) берёт только последние дни.
 *
 *   bun run yandex:backfill 2026-09-01 [2026-10-23]
 *
 * Без второй даты — по вчера. Идёт кусками по 30 дней и ждёт Яндекс без
 * ограничения по времени. Повторный запуск безопасен.
 */
import { moscowDate } from "../services/yandex/common";
import {
  isDirectConfigured,
  syncDirectReport,
} from "../services/yandex/direct";
import {
  isMetrikaConfigured,
  syncMetrikaGoals,
  syncMetrikaLogs,
} from "../services/yandex/metrika";

const CHUNK_DAYS = 30;
const WAIT = { waitMs: 60 * 60_000 };

const [from, to = moscowDate(new Date(), -1)] = process.argv.slice(2);
if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from) || from > to) {
  console.error(
    "Использование: bun run yandex:backfill YYYY-MM-DD [YYYY-MM-DD]",
  );
  process.exit(1);
}

function* ranges(start: string, end: string) {
  let cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + CHUNK_DAYS - 1);
    const stop = chunkEnd < last ? chunkEnd : last;
    yield {
      from: cursor.toISOString().slice(0, 10),
      to: stop.toISOString().slice(0, 10),
    };
    cursor = new Date(stop);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

if (isMetrikaConfigured()) {
  console.log("Метрика, цели:", await syncMetrikaGoals());
  for (const range of ranges(from, to)) {
    for (const source of ["visits", "hits"] as const) {
      const result = await syncMetrikaLogs(source, range, WAIT);
      console.log(`Метрика, ${source} ${range.from}..${range.to}:`, result);
    }
  }
} else {
  console.log("YANDEX_METRIKA_TOKEN не задан — Метрику пропускаю");
}

if (isDirectConfigured()) {
  for (const range of ranges(from, to)) {
    for (const report of ["stats", "search_queries"] as const) {
      const result = await syncDirectReport(report, range, WAIT);
      console.log(`Директ, ${report} ${range.from}..${range.to}:`, result);
    }
  }
} else {
  console.log("YANDEX_DIRECT_TOKEN не задан — Директ пропускаю");
}

process.exit(0);
