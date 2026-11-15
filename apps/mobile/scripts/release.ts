/**
 * Публикует релиз приложения: упаковывает собранный бандл, кладёт его (и
 * APK, если он есть) в публичный бакет и записывает релиз в `app_releases`.
 * После этого приложения на телефонах увидят его в `latestRelease`.
 *
 * Запуск (из apps/mobile; `release` сначала собирает бандл):
 *
 *   bun run release -- --notes "Что нового"
 *   bun run release -- --notes "…" --min-native 1.1.0 --apk ./stariva-1.1.0.apk
 *   bun run release -- --notes "…" --dry-run     # только проверить и упаковать
 *
 * Версия бандла — `version` из package.json: поднимите её перед релизом.
 * `--min-native` — самая старая оболочка (versionName в Android,
 * MARKETING_VERSION в iOS), на которой этот бандл работает. Не указан —
 * берётся минимум прошлого релиза. Поднимайте его, если
 * бандл использует новый нативный плагин: старые телефоны получат просьбу
 * скачать новую сборку, а не сломанный бандл. `--apk` прикладывайте вместе с
 * новой оболочкой.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { desc, eq } from "@stariva/db";
import { db } from "@stariva/db/client";
import { appReleases } from "@stariva/db/schema";
import {
  isPublicStorageConfigured,
  publicObjectUrl,
  uploadPublicObject,
} from "@stariva/storage";
import { zipSync } from "fflate";
import { parseVersion } from "../src/lib/version";

const root = fileURLToPath(new URL("..", import.meta.url));
const distDir = join(root, "dist");

const { values } = parseArgs({
  options: {
    notes: { type: "string", default: "" },
    "min-native": { type: "string" },
    apk: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const { version } = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
) as { version: string };
if (!parseVersion(version))
  fail(`version «${version}» в package.json не X.Y.Z`);

if (values["min-native"] && !parseVersion(values["min-native"])) {
  fail(`--min-native «${values["min-native"]}» не X.Y.Z`);
}

// Capgo распаковывает архив и ищет index.html в его корне
if (!existsSync(join(distDir, "index.html"))) {
  fail("dist/index.html не найден: сначала `bun run build`");
}

function collect(dir: string, files: Record<string, Uint8Array>) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) collect(path, files);
    else {
      const key = relative(distDir, path).split("\\").join("/");
      files[key] = new Uint8Array(readFileSync(path));
    }
  }
}

const files: Record<string, Uint8Array> = {};
collect(distDir, files);
const zip = zipSync(files, { level: 9 });
console.log(
  `Бандл ${version}: ${Object.keys(files).length} файлов, ${(zip.length / 1024 / 1024).toFixed(2)} МБ`,
);

const apkPath = values.apk;
if (apkPath && !existsSync(apkPath)) fail(`APK не найден: ${apkPath}`);

if (!values["dry-run"] && !isPublicStorageConfigured()) {
  fail("Не настроен публичный бакет (AWS_S3_* и AWS_S3_PUBLIC_BUCKET в .env)");
}

const [existing] = await db
  .select({ version: appReleases.version })
  .from(appReleases)
  .where(eq(appReleases.version, version))
  .limit(1);
if (existing) {
  fail(`Релиз ${version} уже опубликован: поднимите version в package.json`);
}

const [last] = await db
  .select({
    buildNumber: appReleases.buildNumber,
    minNativeVersion: appReleases.minNativeVersion,
    apkDownloadUrl: appReleases.apkDownloadUrl,
  })
  .from(appReleases)
  .orderBy(desc(appReleases.buildNumber))
  .limit(1);
const buildNumber = (last?.buildNumber ?? 0) + 1;
// Без --min-native наследуем прежний минимум: иначе обычный выпуск после
// релиза с новым плагином снова пустил бы старые оболочки на несовместимый
// бандл. Понизить минимум можно только явным флагом
const minNative = values["min-native"] ?? last?.minNativeVersion ?? "1.0.0";

if (values["dry-run"]) {
  console.log(
    `Сухой прогон: релиз ${version}, сборка №${buildNumber}, min-native ${minNative}. Ничего не загружено.`,
  );
  process.exit(0);
}

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

// Контрольная сумма нужна приложению: без неё Capgo бандл не скачает
const bundleChecksum = sha256(zip);

// Файлы кэшируются навсегда и бакет не защищает от перезаписи, поэтому хеш
// содержимого — часть ключа: другая сборка той же версии ляжет рядом, а не
// поверх (параллельный запуск не подменит чужой архив)
const bundleKey = `mobile/bundles/${version}-${bundleChecksum.slice(0, 12)}.zip`;
const bundleZipUrl = await uploadPublicObject(
  bundleKey,
  zip,
  "application/zip",
);
console.log(`↑ ${bundleZipUrl}`);

let apkDownloadUrl: string | null = null;
if (apkPath) {
  const apk = new Uint8Array(readFileSync(apkPath));
  const apkKey = `mobile/apk/stariva-${version}-${sha256(apk).slice(0, 12)}.apk`;
  await uploadPublicObject(
    apkKey,
    apk,
    "application/vnd.android.package-archive",
  );
  apkDownloadUrl = publicObjectUrl(apkKey);
  console.log(`↑ ${apkDownloadUrl}`);
} else {
  // Без нового APK ссылка остаётся прежней: старые оболочки по-прежнему
  // просят скачать последнюю сборку
  apkDownloadUrl = last?.apkDownloadUrl ?? null;
}

await db.insert(appReleases).values({
  version,
  bundleZipUrl,
  bundleChecksum,
  minNativeVersion: minNative,
  apkDownloadUrl,
  releaseNotes: values.notes ?? "",
  buildNumber,
});
console.log(
  `✓ Релиз ${version} (сборка №${buildNumber}, min-native ${minNative}) опубликован`,
);
process.exit(0);
