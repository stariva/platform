import { hatchet } from "./client";
import "./env";
import { workflows } from "./workflows";

/**
 * Воркер Hatchet — долгоживущий процесс: забирает задания у движка Hatchet
 * и выполняет их. Запускается отдельным подом (apps/jobs/Dockerfile) под Node:
 * `bun run build` собирает dist/index.js, `bun run start` запускает его через node.
 *
 * Локально: `bun run dev --filter @stariva/jobs` (нужен HATCHET_CLIENT_TOKEN,
 * STOREFRONT_URL, JOBS_SECRET в корневом .env).
 */
async function main() {
  const worker = await hatchet.worker("stariva-worker", {
    workflows,
    // Максимум параллельных запусков на воркер
    slots: 20,
  });

  // Kubernetes останавливает под SIGTERM: дожидаемся текущих заданий
  const stop = () => {
    worker.stop().finally(() => process.exit(0));
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);

  await worker.start();
}

main().catch((err) => {
  console.error("Воркер не запустился:", err);
  process.exit(1);
});
