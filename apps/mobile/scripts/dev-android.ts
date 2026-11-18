/**
 * Проверка приложения на Android одной командой (из apps/mobile):
 *
 *   bun run dev:android                    # живое устройство или первый AVD
 *   bun run dev:android -- --avd Pixel_7   # конкретный эмулятор
 *
 * Шаги: дождаться устройства (при необходимости поднять эмулятор) →
 * vite build → cap sync android → gradlew assembleDebug → adb install →
 * запуск MainActivity → проверка, что процесс жив.
 *
 * SDK ищется в ANDROID_HOME / ANDROID_SDK_ROOT / %LOCALAPPDATA%\Android\Sdk,
 * Java — в JAVA_HOME, PATH или JBR Android Studio (нужна Gradle для сборки).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = fileURLToPath(new URL("..", import.meta.url));
const androidDir = join(root, "android");
const APP_ID = "ru.stariva.workshops";
const isWindows = process.platform === "win32";

const { values } = parseArgs({
  options: { avd: { type: "string" } },
});

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function run(cmd: string, args: string[], cwd = root) {
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: isWindows,
  });
  if (r.status !== 0) fail(`${cmd} ${args.join(" ")} — код ${r.status}`);
}

/** То же, но не падает при ошибке (для необязательных шагов). */
function tryRun(cmd: string, args: string[]) {
  spawnSync(cmd, args, { stdio: "ignore", shell: isWindows });
}

function out(cmd: string, args: string[]): string {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: isWindows });
  return String(r.stdout ?? "");
}

// --- SDK и Java -------------------------------------------------------------

const sdk =
  process.env.ANDROID_HOME ??
  process.env.ANDROID_SDK_ROOT ??
  join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
if (!existsSync(sdk))
  fail(`Android SDK не найден: ${sdk}. Задайте ANDROID_HOME`);
process.env.ANDROID_HOME = sdk;

const adb = join(sdk, "platform-tools", isWindows ? "adb.exe" : "adb");
const emulatorBin = join(
  sdk,
  "emulator",
  isWindows ? "emulator.exe" : "emulator",
);
if (!existsSync(adb)) fail(`adb не найден: ${adb}`);

if (!process.env.JAVA_HOME) {
  const jbr = join(
    process.env.ProgramFiles ?? "C:\\Program Files",
    "Android",
    "Android Studio",
    "jbr",
  );
  if (existsSync(join(jbr, "bin", isWindows ? "java.exe" : "java"))) {
    process.env.JAVA_HOME = jbr;
  }
}

// --- Устройство -------------------------------------------------------------

function onlineDevices(): string[] {
  return out(adb, ["devices"])
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trimEnd().endsWith("\tdevice"))
    .map((line) => line.split("\t")[0]);
}

if (onlineDevices().length === 0) {
  const avds = out(emulatorBin, ["-list-avds"])
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const avd = values.avd ?? avds[0];
  if (!avd) {
    fail(
      "Нет ни одного AVD: создайте эмулятор в Android Studio → Device Manager",
    );
  }
  if (values.avd && !avds.includes(values.avd)) {
    fail(`AVD «${values.avd}» не найден. Доступны: ${avds.join(", ")}`);
  }
  console.log(`Запускаю эмулятор ${avd}…`);
  spawn(emulatorBin, ["-avd", avd], {
    detached: true,
    stdio: "ignore",
  }).unref();

  const deadline = Date.now() + 180_000;
  tryRun(adb, ["wait-for-device"]);
  let booted = false;
  while (Date.now() < deadline) {
    if (out(adb, ["shell", "getprop", "sys.boot_completed"]).trim() === "1") {
      booted = true;
      break;
    }
    await sleep(2000);
  }
  if (!booted) fail("Эмулятор не загрузился за 3 минуты");
  await sleep(3000); // система догружает сервисы после boot_completed
}

const device = onlineDevices()[0];
console.log(`Устройство: ${device}`);

// --- Сборка, установка, запуск ----------------------------------------------

run("bun", ["run", "build"]);
run("bun", ["x", "cap", "sync", "android"]);
run(isWindows ? "gradlew.bat" : "./gradlew", ["assembleDebug"], androidDir);

const apk = join(
  androidDir,
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk",
);
if (!existsSync(apk)) fail(`APK не найден: ${apk}`);
run(adb, ["install", "-r", apk]);

tryRun(adb, ["shell", "wm", "dismiss-keyguard"]);
run(adb, [
  "shell",
  "monkey",
  "-p",
  APP_ID,
  "-c",
  "android.intent.category.LAUNCHER",
  "1",
]);

await sleep(4000);
const pid = out(adb, ["shell", "pidof", APP_ID]).trim();
if (!pid) fail("Приложение не поднялось: смотрите `adb logcat`");
console.log(`✓ Stariva запущена на ${device} (pid ${pid})`);
