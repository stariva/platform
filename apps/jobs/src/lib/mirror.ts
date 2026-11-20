import type { IncomingMessage } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { webApi } from "./web-api";

/** Сколько файлов из пачки копируем одновременно. */
const COPY_CONCURRENCY = 3;
/** Попыток на файл, прежде чем бросить пачку: прогон повторит Hatchet. */
const FILE_ATTEMPTS = 3;
/** Запас времени на файл; большим исходникам добавляем по объёму. */
const FILE_MIN_TIMEOUT_MS = 5 * 60_000;
/** Ожидаемая скорость копирования, байт/с — из неё таймаут файла. */
const EXPECTED_BYTES_PER_SECOND = 2 * 1024 * 1024;
/** Как долго один прогон копирует, прежде чем отдать управление крону. */
const RUN_BUDGET_MS = 40 * 60_000;
/** Пачку, на которую не осталось столько времени, не начинаем. */
const MIN_BATCH_MS = 5 * 60_000;
/** Потолок пачки по числу файлов и объёму: 8 ГиБ при трёх потоках по
 * 2 МБ/с копируется ~22 минуты — с запасом в бюджет прогона. */
const BATCH_MAX_FILES = 1000;
const BATCH_MAX_BYTES = 8 * 1024 ** 3;
/** Claim листирует оба бакета целиком — как чистке, оставляем время sweep'а.
 * Пачки копируются уже под остаток бюджета, так что хватает всегда. */
const CLAIM_TIMEOUT_MS = 280_000;

const MB = 1024 * 1024;

/** Пачка файлов от сайта: подписанные чтение из активного и заливка в зеркало. */
interface MirrorBatch {
  configured: boolean;
  files: {
    key: string;
    size: number;
    contentType: string;
    getUrl: string;
    putUrl: string;
  }[];
  remainingFiles: number;
  remainingBytes: number;
}

/** HTTP-запрос по подписанной ссылке: бакеты могут быть и за http (MinIO). */
function sendRequest(url: string, method: "GET" | "PUT") {
  const factory = url.startsWith("http://") ? httpRequest : httpsRequest;
  return factory(url, { method });
}

/** Сколько байт тела ошибочного ответа читаем для лога. */
const ERROR_BODY_LIMIT = 512;
/** Дольше этого тело ошибки не ждём: сокет может не закрыться. */
const ERROR_BODY_TIMEOUT_MS = 5_000;

/**
 * Отказ хранилища с обрывком тела: S3 объясняет причину кодом (`BadDigest`,
 * `SignatureDoesNotMatch`) и текстом, а голый HTTP 400 в логе ничего не даёт.
 */
function failResponse(
  method: "GET" | "PUT",
  response: IncomingMessage,
  fail: (error: Error) => void,
): void {
  const status = response.statusCode;
  const chunks: Buffer[] = [];
  let size = 0;
  let settled = false;
  const done = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    const body = Buffer.concat(chunks)
      .toString("utf-8")
      .replace(/\s+/g, " ")
      .trim();
    fail(new Error(`${method}: HTTP ${status}${body ? `: ${body}` : ""}`));
  };
  const timer = setTimeout(() => {
    response.destroy();
    done();
  }, ERROR_BODY_TIMEOUT_MS);
  response.on("data", (chunk: Buffer) => {
    if (size >= ERROR_BODY_LIMIT) return;
    chunks.push(chunk);
    size += chunk.length;
  });
  response.once("end", done);
  response.once("close", done);
  response.once("error", done);
}

/**
 * Читает файл из активного бакета потоком и льёт его в зеркало. Content-Length
 * обязателен — S3 не принимает заливку кусками без длины, поэтому в память и
 * на диск исходник не попадает: байты текут из одного сокета в другой. Если
 * поток оборвался раньше времени, Node рвёт заливку из-за несовпадения длины.
 */
function attemptCopy(file: MirrorBatch["files"][number]): Promise<void> {
  const timeoutMs =
    (file.size / EXPECTED_BYTES_PER_SECOND) * 1000 + FILE_MIN_TIMEOUT_MS;
  const source = sendRequest(file.getUrl, "GET");
  let put: ReturnType<typeof sendRequest> | undefined;
  const timer = setTimeout(() => {
    const error = new Error(
      `copy timed out after ${Math.round(timeoutMs / 1000)} с`,
    );
    put?.destroy(error);
    source.destroy(error);
  }, timeoutMs);

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      put?.destroy();
      source.destroy();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };

    source.once("error", fail);
    source.once("response", (response: IncomingMessage) => {
      if (response.statusCode !== 200) {
        response.resume();
        fail(new Error(`GET: HTTP ${response.statusCode}`));
        return;
      }

      // Подпись заливки включает Content-Type — шлём в точности подписанный
      put = sendRequest(file.putUrl, "PUT");
      put.setHeader("Content-Type", file.contentType);
      put.setHeader("Content-Length", String(file.size));
      put.once("error", fail);
      put.once("response", (target) => {
        // Тело ответа не нужно: статус говорит всё
        target.resume();
        if (target.statusCode === 200) finish();
        else fail(new Error(`PUT: HTTP ${target.statusCode}`));
      });
      response.once("error", fail);
      response.pipe(put);
    });
    source.end();
  });
}

/** Один файл с повторами: обрыв сети или 5xx не должны ронять пачку. */
async function copyFile(file: MirrorBatch["files"][number]): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await attemptCopy(file);
      return;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (attempt >= FILE_ATTEMPTS) {
        throw new Error(`copy ${file.key}: ${reason}`);
      }
      console.warn(`[mirror] ${file.key}, попытка ${attempt}: ${reason}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

/**
 * Копирует файлы мастер-классов из активного бакета в зеркало, пока сайт
 * выдаёт пачки и не вышел бюджет прогона. Каждая пачка подбирается под
 * остаток бюджета, чтобы её не срезал таймаут Hatchet посреди копирования.
 * Очередной прогон (каждый час) продолжает с того же места: скопированное
 * из выдачи пропадает.
 *
 * Зеркало не настроено — тихо заканчиваем: крон не должен сыпать ошибками.
 * Один упорный файл бросает прогон целиком: уже скопированное сохраняется,
 * Hatchet повторит прогон, а файл останется в выдаче.
 */
export async function mirrorSync(options: { budgetMs?: number } = {}): Promise<{
  copiedFiles: number;
  copiedBytes: number;
  remainingFiles: number;
  remainingBytes: number;
}> {
  const deadline = Date.now() + (options.budgetMs ?? RUN_BUDGET_MS);
  let copiedFiles = 0;
  let copiedBytes = 0;
  let remainingFiles = 0;
  let remainingBytes = 0;

  for (;;) {
    // Пачку берём под скорость одного потока: большой файл нельзя
    // разделить между COPY_CONCURRENCY потоками. Иначе Hatchet
    // убил бы задачу на середине пачки, теряя её целиком каждый прогон.
    const restMs = deadline - Date.now();
    if (restMs <= MIN_BATCH_MS) {
      console.log("[mirror] бюджет прогона вышел — продолжим в следующий раз");
      break;
    }
    const affordableBytes = Math.floor(
      (restMs / 1000) * EXPECTED_BYTES_PER_SECOND,
    );
    const batch: MirrorBatch = await webApi.jobs.storage.mirrorSync(
      {
        maxFiles: BATCH_MAX_FILES,
        maxBytes: Math.min(BATCH_MAX_BYTES, affordableBytes),
      },
      { context: { timeout: CLAIM_TIMEOUT_MS } },
    );
    if (!batch.configured) {
      console.log("[mirror] зеркало не настроено — копировать нечего");
      return { copiedFiles, copiedBytes, remainingFiles: 0, remainingBytes: 0 };
    }
    remainingFiles = batch.remainingFiles;
    remainingBytes = batch.remainingBytes;
    if (batch.files.length === 0) break;

    console.log(
      `[mirror] пачка: ${batch.files.length} файлов, осталось ` +
        `${remainingFiles} файлов / ${(remainingBytes / MB).toFixed(1)} МБ`,
    );
    let next = 0;
    let failure: unknown = null;
    await Promise.all(
      Array.from({ length: COPY_CONCURRENCY }, async () => {
        while (next < batch.files.length) {
          const file = batch.files[next++] as MirrorBatch["files"][number];
          try {
            await copyFile(file);
            copiedFiles++;
            copiedBytes += file.size;
          } catch (error) {
            // Остальные файлы пачки докопируем: один файл не должен
            // останавливать сотни остальных
            failure = error;
            console.error("[mirror] файл не скопирован:", error);
          }
        }
      }),
    );
    if (failure) throw failure;
  }

  console.log(
    `[mirror] скопировано ${copiedFiles} файлов / ` +
      `${(copiedBytes / MB).toFixed(1)} МБ; осталось ${remainingFiles} файлов / ` +
      `${(remainingBytes / MB).toFixed(1)} МБ`,
  );
  return { copiedFiles, copiedBytes, remainingFiles, remainingBytes };
}
