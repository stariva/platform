import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
} from "@ai-sdk/provider";

/**
 * Описание провайдера в цепочке fallback.
 */
export type FallbackEntry = {
  /** Человекочитаемое имя провайдера для логов (groq, cerebras, ...) */
  name: string;
  /** Модель, реализующая интерфейс LanguageModelV4 */
  model: LanguageModelV4;
};

/**
 * Типы частей стрима, которые означают «модель уже начала отдавать ответ».
 * После любой из них переключаться на другого провайдера уже нельзя —
 * клиент мог получить часть данных. До них переключение безопасно.
 */
const CONTENT_PART_TYPES = new Set<LanguageModelV4StreamPart["type"]>([
  "text-delta",
  "reasoning-delta",
  "tool-call",
  "tool-input-start",
  "tool-input-delta",
  "tool-result",
  "tool-approval-request",
  "file",
  "source",
]);

// ─── Определение ошибок, при которых стоит пробовать следующий провайдер ────

/**
 * Собирает все текстовые поля ошибки (message / type / code) рекурсивно,
 * обходя вложенные error / data / responseBody / cause.
 *
 * Это важно, потому что провайдеры (Groq) часто отдают ошибку обычным
 * объектом `{ message, type }`, а НЕ экземпляром Error. В таком случае
 * `String(error)` вернул бы "[object Object]" и текст ошибки потерялся бы.
 */
function collectErrorText(error: unknown, depth = 0): string {
  if (error == null || depth > 4) return "";
  if (typeof error === "string") return error;
  if (typeof error !== "object") return String(error);

  const obj = error as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof obj.message === "string") parts.push(obj.message);
  if (typeof obj.type === "string") parts.push(obj.type);
  if (typeof obj.code === "string") parts.push(obj.code);

  parts.push(collectErrorText(obj.error, depth + 1));
  parts.push(collectErrorText(obj.data, depth + 1));
  parts.push(collectErrorText(obj.responseBody, depth + 1));
  parts.push(collectErrorText(obj.cause, depth + 1));

  return parts.filter(Boolean).join(" | ");
}

/** HTTP-статусы, при которых имеет смысл переключиться на резерв. */
function getStatusCode(error: unknown): number | undefined {
  if (
    error != null &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
  ) {
    return (error as { statusCode: number }).statusCode;
  }
  return undefined;
}

/**
 * Ошибки именно «модель не смогла корректно вызвать функцию».
 * Их нельзя вылечить сменой провайдера того же класса — нужен резерв
 * либо повтор без инструментов.
 */
export function isToolCallError(error: unknown): boolean {
  const text = collectErrorText(error);
  return (
    text.includes("Failed to call a function") ||
    text.includes("failed_generation") ||
    text.includes("tool_use_failed")
  );
}

/**
 * Возвращает true, если ошибку имеет смысл «пережить» переключением
 * на резервного провайдера (rate limit, перегрузка, сетевые сбои,
 * неудачный вызов функции и т.п.).
 */
export function isFallbackError(error: unknown): boolean {
  const status = getStatusCode(error);
  if (
    status === 400 || // Groq отдаёт failed_generation со статусом 400
    status === 408 ||
    status === 409 ||
    status === 429 ||
    (status !== undefined && status >= 500)
  ) {
    return true;
  }

  const text = collectErrorText(error);
  return (
    // Groq: модель не смогла вызвать tool — пробуем другой провайдер
    text.includes("Failed to call a function") ||
    text.includes("failed_generation") ||
    text.includes("tool_use_failed") ||
    // Groq: вернул пустой ответ без текста и без tool calls
    text.includes("empty_response") ||
    // Groq: в истории есть reasoning parts, которые модель не поддерживает
    text.includes("reasoning is not supported") ||
    text.includes("rate_limit") ||
    text.includes("Rate limit") ||
    text.includes("overloaded") ||
    text.includes("Service Unavailable") ||
    text.includes("Bad Gateway") ||
    text.includes("timeout") ||
    text.includes("ETIMEDOUT") ||
    text.includes("ECONNRESET") ||
    text.includes("ECONNREFUSED")
  );
}

// ─── Синтетический ответ при недоступности всех провайдеров ─────────────────

const EMPTY_USAGE = {
  inputTokens: {
    total: undefined,
    noCache: undefined,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: undefined, text: undefined, reasoning: undefined },
} as const;

const FALLBACK_FINISH = { unified: "stop", raw: "fallback" } as const;

/** Стрим из одного текстового сообщения — будто его сгенерировала модель. */
function syntheticTextStreamResult(text: string): LanguageModelV4StreamResult {
  const id = "fallback-message";
  const stream = new ReadableStream<LanguageModelV4StreamPart>({
    start(controller) {
      controller.enqueue({ type: "stream-start", warnings: [] });
      controller.enqueue({ type: "text-start", id });
      controller.enqueue({ type: "text-delta", id, delta: text });
      controller.enqueue({ type: "text-end", id });
      controller.enqueue({
        type: "finish",
        usage: EMPTY_USAGE,
        finishReason: FALLBACK_FINISH,
      });
      controller.close();
    },
  });
  return { stream };
}

/** Аналог для non-streaming вызова. */
function syntheticGenerateResult(text: string): LanguageModelV4GenerateResult {
  return {
    content: [{ type: "text", text }],
    finishReason: FALLBACK_FINISH,
    usage: EMPTY_USAGE,
    warnings: [],
  };
}

function resolveExhaustedMessage(
  message: string | ((error: unknown) => string),
  error: unknown,
): string {
  return typeof message === "function" ? message(error) : message;
}

// ─── Стриминг с переключением провайдеров ───────────────────────────────────

/**
 * Запускает doStream у первого провайдера, который успел отдать контент.
 *
 * Логика устойчивости:
 *  - если doStream упал ошибкой ДО возврата стрима (например 429 на запросе) —
 *    пробуем следующего провайдера;
 *  - если стрим начался, но первая значимая часть — это `error` (или стрим
 *    закончился вообще без контента) — тоже пробуем следующего провайдера;
 *  - как только пришла первая значимая часть (текст / tool call), мы
 *    «фиксируемся» на этом провайдере и проксируем стрим как есть.
 *
 * Благодаря тому, что эта логика живёт на уровне модели, переключение
 * срабатывает на КАЖДОМ шаге агентного цикла streamText (multi-step),
 * а не только на самом первом запросе.
 */
async function attemptStream(
  entries: FallbackEntry[],
  options: LanguageModelV4CallOptions,
  onFallback: (from: string, to: string, error: unknown) => void,
): Promise<LanguageModelV4StreamResult> {
  let lastError: unknown;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const isLast = i === entries.length - 1;
    let reader: ReadableStreamDefaultReader<LanguageModelV4StreamPart> | null =
      null;

    try {
      const result = await entry.model.doStream(options);
      reader = result.stream.getReader();

      const buffered: LanguageModelV4StreamPart[] = [];
      let hasContent = false;
      let upstreamDone = false;

      // Читаем стрим до первой значимой части, ошибки или конца стрима.
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          upstreamDone = true;
          break;
        }

        // Ошибка до начала контента — повод переключиться на резерв.
        if (value.type === "error" && !hasContent) {
          throw value.error ?? new Error("stream_error");
        }

        buffered.push(value);

        if (CONTENT_PART_TYPES.has(value.type)) {
          hasContent = true;
          break;
        }
      }

      // Стрим закончился без единой значимой части — это пустой ответ.
      if (!hasContent && upstreamDone) {
        throw new Error(
          "empty_response: provider returned no text and no tool calls",
        );
      }

      // Фиксируемся на этом провайдере: проигрываем буфер + остаток стрима.
      const committedReader = reader;
      reader = null; // не отменяем в finally/catch — стрим уходит наружу
      const stream = new ReadableStream<LanguageModelV4StreamPart>({
        async start(controller) {
          for (const chunk of buffered) {
            controller.enqueue(chunk);
          }
          if (upstreamDone) {
            controller.close();
            return;
          }
          try {
            while (true) {
              const { value, done } = await committedReader.read();
              if (done) break;
              controller.enqueue(value);
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
        cancel(reason) {
          committedReader.cancel(reason).catch(() => {});
        },
      });

      return { stream, request: result.request, response: result.response };
    } catch (error) {
      lastError = error;
      // Освобождаем неудачный стрим, если он был открыт.
      if (reader) {
        reader.cancel(error).catch(() => {});
      }

      const nextEntry = entries[i + 1];
      if (!isLast && nextEntry && isFallbackError(error)) {
        onFallback(entry.name, nextEntry.name, error);
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("no_available_providers");
}

/**
 * Запускает стрим с переключением провайдеров (см. attemptStream).
 *
 * Дополнительный рубеж: если ВСЕ провайдеры упали именно на вызове функции
 * (Groq «Failed to call a function» / failed_generation), делаем повторный
 * проход без инструментов. Так клиент гарантированно получит текстовый ответ,
 * а не ошибку.
 */
async function streamWithFallback(
  entries: FallbackEntry[],
  options: LanguageModelV4CallOptions,
  onFallback: (from: string, to: string, error: unknown) => void,
  exhaustedMessage?: string | ((error: unknown) => string),
): Promise<LanguageModelV4StreamResult> {
  try {
    try {
      return await attemptStream(entries, options, onFallback);
    } catch (error) {
      const hasTools = (options.tools?.length ?? 0) > 0;
      if (hasTools && isToolCallError(error)) {
        onFallback("tools", "no-tools", error);
        const noToolsOptions: LanguageModelV4CallOptions = {
          ...options,
          tools: undefined,
          toolChoice: undefined,
        };
        return await attemptStream(entries, noToolsOptions, onFallback);
      }
      throw error;
    }
  } catch (error) {
    // Все провайдеры недоступны. Чтобы клиент не получил ошибку, отдаём
    // обычный текстовый ответ (если задано резервное сообщение).
    if (exhaustedMessage != null) {
      console.error(
        "[ai/chat] все провайдеры недоступны, отдаём резервное сообщение:",
        error,
      );
      return syntheticTextStreamResult(
        resolveExhaustedMessage(exhaustedMessage, error),
      );
    }
    throw error;
  }
}

// ─── Генерация (non-streaming) с переключением провайдеров ───────────────────

async function attemptGenerate(
  entries: FallbackEntry[],
  options: LanguageModelV4CallOptions,
  onFallback: (from: string, to: string, error: unknown) => void,
): Promise<LanguageModelV4GenerateResult> {
  let lastError: unknown;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const isLast = i === entries.length - 1;
    try {
      return await entry.model.doGenerate(options);
    } catch (error) {
      lastError = error;
      const nextEntry = entries[i + 1];
      if (!isLast && nextEntry && isFallbackError(error)) {
        onFallback(entry.name, nextEntry.name, error);
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("no_available_providers");
}

async function generateWithFallback(
  entries: FallbackEntry[],
  options: LanguageModelV4CallOptions,
  onFallback: (from: string, to: string, error: unknown) => void,
  exhaustedMessage?: string | ((error: unknown) => string),
): Promise<LanguageModelV4GenerateResult> {
  try {
    try {
      return await attemptGenerate(entries, options, onFallback);
    } catch (error) {
      const hasTools = (options.tools?.length ?? 0) > 0;
      if (hasTools && isToolCallError(error)) {
        onFallback("tools", "no-tools", error);
        const noToolsOptions: LanguageModelV4CallOptions = {
          ...options,
          tools: undefined,
          toolChoice: undefined,
        };
        return await attemptGenerate(entries, noToolsOptions, onFallback);
      }
      throw error;
    }
  } catch (error) {
    if (exhaustedMessage != null) {
      console.error(
        "[ai/chat] все провайдеры недоступны, отдаём резервное сообщение:",
        error,
      );
      return syntheticGenerateResult(
        resolveExhaustedMessage(exhaustedMessage, error),
      );
    }
    throw error;
  }
}

// ─── Фабрика fallback-модели ─────────────────────────────────────────────────

export type FallbackModelOptions = {
  /** Колбэк вызывается при каждом переключении на резервного провайдера. */
  onFallback?: (from: string, to: string, error: unknown) => void;
  /**
   * Текст, который будет отдан как обычный ответ модели, если ВСЕ провайдеры
   * недоступны. Это позволяет не показывать клиенту техническую ошибку.
   * Можно передать функцию для разного текста в зависимости от ошибки.
   * Если не задано — ошибка пробрасывается наружу как раньше.
   */
  exhaustedMessage?: string | ((error: unknown) => string);
};

/**
 * Оборачивает список моделей в одну модель LanguageModelV4 с автоматическим
 * переключением на резерв при ошибках. Переключение прозрачно для streamText
 * и срабатывает на каждом шаге агентного цикла.
 */
export function createFallbackModel(
  entries: FallbackEntry[],
  options: FallbackModelOptions = {},
): LanguageModelV4 {
  if (entries.length === 0) {
    throw new Error("createFallbackModel: требуется хотя бы одна модель");
  }

  const primary = entries[0]!.model;
  const onFallback =
    options.onFallback ??
    ((from, to, error) => {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[ai/chat] fallback ${from} → ${to}: ${reason}`);
    });
  const exhaustedMessage = options.exhaustedMessage;

  return {
    specificationVersion: "v4",
    provider: `fallback(${entries.map((e) => e.name).join(",")})`,
    modelId: primary.modelId,
    supportedUrls: primary.supportedUrls,
    doStream: (callOptions) =>
      streamWithFallback(entries, callOptions, onFallback, exhaustedMessage),
    doGenerate: (callOptions) =>
      generateWithFallback(entries, callOptions, onFallback, exhaustedMessage),
  };
}
