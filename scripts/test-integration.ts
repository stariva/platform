/*
 * Интеграционные тесты с настоящей Postgres: `bun run test:integration`.
 *
 * Каждому набору — своя чистая база: раннер пересоздаёт её, прогоняет
 * миграции и запускает файл отдельным процессом. В общем `bun test` эти
 * файлы пропускаются: @stariva/db читает POSTGRES_URL один раз на процесс,
 * и другой тест успевает открыть пул раньше.
 *
 * TEST_POSTGRES_URL — сервер для тестовых баз (только 127.0.0.1: базы
 * удаляются). Локально:
 *   docker compose up -d postgres
 *   TEST_POSTGRES_URL=postgres://postgres:password@127.0.0.1:5432/postgres \
 *     bun run test:integration
 */
import { Glob } from "bun";
import { Client } from "pg";
import { migrate } from "../packages/db/src/scripts/migrate";

interface Suite {
  file: string;
  /** Переменная, без которой файл пропускает тест. */
  env: string;
  database: string;
  /** SQL после миграций: например, убрать сиды, которые мешают тесту. */
  prepare?: string;
}

const suites: Suite[] = [
  {
    file: "apps/web/src/lib/custom-order/inbox.integration.test.ts",
    env: "CUSTOM_ORDER_TEST_DATABASE_URL",
    database: "stariva_custom_order_test",
  },
  {
    file: "apps/web/src/lib/workshops/notifications.integration.test.ts",
    env: "NOTIFICATION_TEST_DATABASE_URL",
    database: "stariva_notification_test",
  },
  {
    file: "apps/web/src/lib/workshops/unpaid-reminder.integration.test.ts",
    // Тест ждёт базу уведомлений; раннер пересоздаёт её перед набором
    env: "NOTIFICATION_TEST_DATABASE_URL",
    database: "stariva_notification_test",
  },
  {
    file: "packages/web-api/src/services/video-renditions.integration.test.ts",
    env: "RENDITION_TEST_DATABASE_URL",
    database: "stariva_rendition_test",
    // Тест ждёт пустой каталог мастер-классов, а 0007 его засевает
    prepare: "TRUNCATE workshops CASCADE",
  },
];

function serverUrl(): URL {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: скрипт идёт мимо turbo
  const raw = process.env.TEST_POSTGRES_URL;
  if (!raw) {
    throw new Error(
      "TEST_POSTGRES_URL is not set, e.g. postgres://postgres:password@127.0.0.1:5432/postgres",
    );
  }
  const url = new URL(raw);
  // Раннер удаляет базы: только локальный сервер, никогда не прод
  if (url.hostname !== "127.0.0.1") {
    throw new Error(
      `TEST_POSTGRES_URL must point at 127.0.0.1, got ${url.hostname}`,
    );
  }
  return url;
}

/** Новый *.integration.test.ts без записи здесь молча не попал бы в CI. */
async function assertAllSuitesListed() {
  const known = new Set(suites.map((suite) => suite.file));
  const unlisted: string[] = [];
  const glob = new Glob("{apps,packages}/*/src/**/*.integration.test.ts");
  for await (const file of glob.scan({ cwd: process.cwd() })) {
    const normalized = file.replaceAll("\\", "/");
    if (!known.has(normalized)) unlisted.push(normalized);
  }
  if (unlisted.length > 0) {
    throw new Error(
      `Add these files to scripts/test-integration.ts:\n  ${unlisted.join("\n  ")}`,
    );
  }
}

async function recreateDatabase(server: URL, suite: Suite): Promise<URL> {
  const admin = new Client({ connectionString: server.href });
  await admin.connect();
  try {
    const name = admin.escapeIdentifier(suite.database);
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }

  const url = new URL(server);
  url.pathname = `/${suite.database}`;
  const client = new Client({ connectionString: url.href });
  await client.connect();
  try {
    await migrate(client);
    if (suite.prepare) await client.query(suite.prepare);
  } finally {
    await client.end();
  }
  return url;
}

/** Пропущенный тест — тоже провал: значит, переменная до файла не дошла. */
function verdict(output: string, exitCode: number): string | null {
  if (exitCode !== 0) return `exit code ${exitCode}`;
  const pass = Number(output.match(/^\s*(\d+) pass/m)?.[1] ?? 0);
  const skip = Number(output.match(/^\s*(\d+) skip/m)?.[1] ?? 0);
  if (skip > 0) return `${skip} test(s) skipped`;
  if (pass === 0) return "no tests ran";
  return null;
}

async function runSuite(suite: Suite, url: URL): Promise<string | null> {
  // --no-env-file: локальный .env может смотреть в боевую базу и в живые
  // Telegram и почту, тестам он не нужен
  const proc = Bun.spawn(["bun", "--no-env-file", "test", suite.file], {
    env: { ...process.env, POSTGRES_URL: url.href, [suite.env]: url.href },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  return verdict(`${stdout}\n${stderr}`, exitCode);
}

const server = serverUrl();
await assertAllSuitesListed();

const failures: string[] = [];
for (const suite of suites) {
  console.log(`\n▶ ${suite.file} (${suite.database})`);
  const url = await recreateDatabase(server, suite);
  const failure = await runSuite(suite, url);
  if (failure) failures.push(`${suite.file}: ${failure}`);
}

if (failures.length > 0) {
  console.error(`\nIntegration tests failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`\nAll ${suites.length} integration suites passed`);
