/**
 * Собирает подписанный релизный APK «Stariva Мастер-классы» локально.
 *
 *   bun run apk:release
 *   bun run apk:release -- --version-code 12 --version-name 1.2.0
 *   bun run apk:release -- --out ./builds --dry-run
 *
 * Шаги: проверить ключ подписи, SDK и JDK → (по флагам) поднять версии
 * оболочки в Android и iOS → vite build → cap sync android → gradlew assembleRelease →
 * скопировать APK в --out (по умолчанию apps/mobile/apk) → проверить подпись
 * через apksigner. Если сборка упала, версии оболочки откатываются.
 *
 * Ключ берётся из env или gradle.properties — из тех же источников, что
 * использует android/app/build.gradle и workflow «Mobile release»:
 * ANDROID_KEYSTORE_FILE, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS,
 * ANDROID_KEY_PASSWORD. Ключ один на всю жизнь приложения, вне git.
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = fileURLToPath(new URL("..", import.meta.url));
const androidDir = join(root, "android");
const appDir = join(androidDir, "app");
const gradlePath = join(appDir, "build.gradle");
const pbxprojPath = join(
  root,
  "ios",
  "App",
  "App.xcodeproj",
  "project.pbxproj",
);
const isWindows = process.platform === "win32";

const { values } = parseArgs({
  options: {
    "version-code": { type: "string" },
    "version-name": { type: "string" },
    out: { type: "string", default: "apk" },
    "dry-run": { type: "boolean", default: false },
  },
});

/** Откат версий оболочки, если сборка не дошла до APK. */
let restoreVersions: (() => void) | undefined;

function fail(message: string): never {
  console.error(`✗ ${message}`);
  if (restoreVersions) {
    restoreVersions();
    console.error("Версии оболочки возвращены к прежним");
  }
  process.exit(1);
}

function warn(message: string) {
  console.warn(`! ${message}`);
}

function run(cmd: string, args: string[], cwd = root) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: isWindows });
  if (r.status !== 0) fail(`${cmd} ${args.join(" ")} — код ${r.status}`);
}

/**
 * Свойство так, как его увидит findProperty в build.gradle: ORG_GRADLE_PROJECT_*
 * из env, затем gradle.properties в Gradle user home, затем проектный.
 */
function gradleProperty(name: string): string | undefined {
  const fromEnv = process.env[`ORG_GRADLE_PROJECT_${name}`];
  if (fromEnv) return fromEnv;
  const gradleUserHome =
    process.env.GRADLE_USER_HOME || join(homedir(), ".gradle");
  for (const file of [
    join(gradleUserHome, "gradle.properties"),
    join(androidDir, "gradle.properties"),
  ]) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8")
      .split(/\r?\n/)
      .find((l) => new RegExp(`^\\s*${name}\\s*=`).test(l));
    const value = line
      ?.slice(line.indexOf("=") + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (value) return value;
  }
  return undefined;
}

/** env имеет приоритет над gradle.properties — так же, как в build.gradle. */
function signingValue(name: string): string | undefined {
  return process.env[name] || gradleProperty(name);
}

// --- Версии оболочки ---------------------------------------------------------

const gradle = readFileSync(gradlePath, "utf8");
let versionCode = /versionCode (\d+)/.exec(gradle)?.[1];
let versionName = /versionName "([^"]+)"/.exec(gradle)?.[1];
if (!versionCode || !/^\d+$/.test(versionCode) || +versionCode <= 0) {
  fail(`versionCode в android/app/build.gradle некорректен: ${versionCode}`);
}
if (!versionName || !/^\d+\.\d+\.\d+$/.test(versionName)) {
  fail(`versionName в android/app/build.gradle не X.Y.Z: ${versionName}`);
}

const oldCode = versionCode;
if (values["version-code"] !== undefined) {
  const code = values["version-code"];
  if (!/^\d+$/.test(code) || +code <= 0)
    fail(`--version-code должен быть положительным числом, получено «${code}»`);
  if (+code <= +oldCode)
    fail(
      `--version-code ${code} должен быть больше текущего ${oldCode}: иначе APK не встанет поверх прежнего`,
    );
  versionCode = code;
}
if (values["version-name"] !== undefined) {
  const name = values["version-name"];
  if (!/^\d+\.\d+\.\d+$/.test(name))
    fail(`--version-name должен быть X.Y.Z, получено «${name}»`);
  versionName = name;
}

const bumpVersions =
  versionCode !== oldCode || values["version-name"] !== undefined;
if (bumpVersions && values["dry-run"]) {
  console.log(
    `Оболочка: versionCode ${oldCode} → ${versionCode}, versionName ${versionName}`,
  );
}

// --- Подпись и SDK -----------------------------------------------------------

const keystore = signingValue("ANDROID_KEYSTORE_FILE");
if (!keystore) {
  fail(
    "Ключ подписи не задан: ANDROID_KEYSTORE_FILE в env или gradle.properties. См. README → «Выпуск новой оболочки»",
  );
}
// build.gradle резолвит file(keystore) относительно android/app
const keystorePath = isAbsolute(keystore)
  ? keystore
  : resolve(appDir, keystore);
if (!existsSync(keystorePath)) fail(`Keystore не найден: ${keystorePath}`);

for (const name of [
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
]) {
  if (!signingValue(name)) fail(`${name} не задан (env или gradle.properties)`);
}

const sdk =
  process.env.ANDROID_HOME ??
  process.env.ANDROID_SDK_ROOT ??
  join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
if (!existsSync(sdk)) {
  if (values["dry-run"])
    warn(`Android SDK не найден: ${sdk}. Задайте ANDROID_HOME`);
  else fail(`Android SDK не найден: ${sdk}. Задайте ANDROID_HOME`);
} else {
  process.env.ANDROID_HOME = sdk;
}

// gradlew берёт java из JAVA_HOME, а без него — из PATH; проверяем тот же
const javaHome = process.env.JAVA_HOME;
const javaBin = javaHome
  ? join(javaHome, "bin", isWindows ? "java.exe" : "java")
  : "java";
const javaSource = javaHome ? `JAVA_HOME (${javaBin})` : "PATH";
const java = spawnSync(javaBin, ["-version"], {
  encoding: "utf8",
  shell: isWindows && !javaHome,
});
const javaVersion = /version "(\d+)(?:\.(\d+))?/.exec(
  `${java.stdout ?? ""}${java.stderr ?? ""}`,
);
const major = javaVersion?.[1] === "1" ? javaVersion?.[2] : javaVersion?.[1];
if (!major) {
  if (values["dry-run"])
    warn(`Java не найден в ${javaSource}. Для Capacitor 8 нужен JDK 21`);
  else fail(`Java не найден в ${javaSource}. Для Capacitor 8 нужен JDK 21`);
}
if (major && +major < 21)
  warn(`Java ${major}, а плагины Capacitor 8 собираются под JDK 21`);

// --- Сборка ------------------------------------------------------------------

const apkSrc = join(
  appDir,
  "build",
  "outputs",
  "apk",
  "release",
  "app-release.apk",
);
const outDir = resolve(root, values.out);
const apkName = `stariva-${versionName}-${versionCode}.apk`;
const apkDst = join(outDir, apkName);

if (values["dry-run"]) {
  console.log("Сухой прогон: сборка и копирование APK не выполнялись.");
  console.log(`  keystore: ${keystorePath}`);
  console.log(`  SDK: ${sdk}, Java: ${major ?? "не найден"}`);
  console.log(`  APK → ${apkDst}`);
  process.exit(0);
}

if (bumpVersions) {
  const pbxproj = readFileSync(pbxprojPath, "utf8");
  restoreVersions = () => {
    writeFileSync(gradlePath, gradle);
    writeFileSync(pbxprojPath, pbxproj);
  };
  writeFileSync(
    gradlePath,
    gradle
      .replace(/versionCode \d+/, `versionCode ${versionCode}`)
      .replace(/versionName "[^"]*"/, `versionName "${versionName}"`),
  );
  // Тест native-config.test.ts требует одинаковых версий на Android и iOS —
  // обновляем оба значения в Xcode, чтобы сборка не ломала checks
  writeFileSync(
    pbxprojPath,
    pbxproj
      .replace(
        /MARKETING_VERSION = [^;]+;/g,
        `MARKETING_VERSION = ${versionName};`,
      )
      .replace(
        /CURRENT_PROJECT_VERSION = [^;]+;/g,
        `CURRENT_PROJECT_VERSION = ${versionCode};`,
      ),
  );
  console.log(
    `Версии оболочки: versionCode ${versionCode}, versionName ${versionName} (Android + iOS)`,
  );
}

console.log("Собираю веб-бандл и синхронизирую Android…");
run("bun", ["run", "build"]);
run("bun", ["x", "cap", "sync", "android"]);

console.log("Собираю подписанный release APK…");
run(
  isWindows ? "gradlew.bat" : "./gradlew",
  ["assembleRelease", "--no-daemon"],
  androidDir,
);

if (!existsSync(apkSrc)) fail(`APK не найден: ${apkSrc}`);
mkdirSync(outDir, { recursive: true });
copyFileSync(apkSrc, apkDst);
restoreVersions = undefined;

// Подписан ли файл тем ключом — проверяем apksigner из SDK, если он есть
const buildToolsDir = join(sdk, "build-tools");
if (existsSync(buildToolsDir)) {
  const toolVersion = readdirSync(buildToolsDir)
    .filter((name) => /^\d/.test(name))
    .sort()
    .reverse()[0];
  const apksigner =
    toolVersion &&
    join(buildToolsDir, toolVersion, isWindows ? "apksigner.bat" : "apksigner");
  if (apksigner && existsSync(apksigner)) {
    const verified = spawnSync(apksigner, ["verify", "--print-certs", apkDst], {
      encoding: "utf8",
      shell: isWindows,
    });
    if (verified.status !== 0) {
      fail(
        `APK не прошёл проверку подписи: ${verified.stdout ?? ""}${verified.stderr ?? ""}`,
      );
    }
    console.log("Подпись проверена (apksigner):");
    console.log((verified.stdout ?? "").trim());
  }
}

console.log(`✓ APK готов: ${apkDst}`);
console.log(
  `Дальше: bun run release -- --apk "${apkDst}" --min-native ${versionName} --notes "Что нового"`,
);
