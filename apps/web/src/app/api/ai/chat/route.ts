import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  InvalidToolInputError,
  isStepCount,
  type ModelMessage,
  streamText,
  type ToolSet,
  toUIMessageStream,
  type UIMessage,
  validateUIMessages,
} from "ai";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { getSession } from "@/lib/auth/session";
import {
  createFallbackModel,
  type FallbackEntry,
} from "@/lib/chat/fallback-model";
import { saveAssistantMessage, saveUserMessage } from "@/lib/chat/history";
import { buildSystemPrompt } from "@/lib/chat/knowledge";
import { chatTools } from "@/lib/chat/tools";
import { readJsonBody } from "@/lib/read-json";
import { fetchPublishedWorkshops } from "@/lib/workshops/workshops-db";

export const runtime = "nodejs";
export const maxDuration = 30;

// Ограничение нагрузки: не пропускаем гигантские истории в модель
const MAX_MESSAGES = 24;
const MAX_CHARS_PER_MESSAGE = 4000;
// История приходит целиком, с результатами инструментов (списки товаров)
const MAX_BODY_BYTES = 1024 * 1024;

// ─── Провайдеры ──────────────────────────────────────────────────────────────

/**
 * Возвращает список доступных моделей. Единственный провайдер — OpenAI-совместимый
 * роутер (env.AI_BASE_URL), ключ и модель задаются через AI_API_KEY / AI_MODEL.
 */
function getAvailableModels(): FallbackEntry[] {
  const models: FallbackEntry[] = [];

  if (env.AI_API_KEY) {
    const router = createOpenAICompatible({
      name: "router",
      apiKey: env.AI_API_KEY,
      baseURL: env.AI_BASE_URL,
    });
    models.push({
      name: "router",
      model: router(env.AI_MODEL) as LanguageModelV4,
    });
  }

  return models;
}

// ─── Починка вызовов инструментов ────────────────────────────────────────────

/**
 * Рекурсивно удаляет null-значения из объекта.
 * Модели (особенно Groq/llama) часто присылают `null` вместо того, чтобы
 * опустить необязательное поле — это ломает Zod-валидацию (.optional()
 * пропускает только undefined). После удаления null необязательные поля
 * проходят валидацию, а поля с .default() получают значение по умолчанию.
 */
function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val === null) continue;
      out[key] = stripNulls(val);
    }
    return out;
  }
  return value;
}

/** Путь страницы, с которой написали, — без query, там бывают метки и токены. */
function refererPath(request: NextRequest): string | null {
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return url.host === request.nextUrl.host ? url.pathname : null;
  } catch {
    return null;
  }
}

// ─── Основной обработчик ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const providers = getAvailableModels();

  if (providers.length === 0) {
    return NextResponse.json(
      { error: "AI-консультант не настроен", code: "not_configured" },
      { status: 503 },
    );
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (body === "too_large") {
    return NextResponse.json(
      { error: "Слишком длинная переписка" },
      { status: 413 },
    );
  }
  if (body === null) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const rawMessages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(rawMessages)) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  // sessionId группирует диалог в админке.
  // Приходит из браузера, поэтому пропускаем только короткий безопасный id.
  const rawSessionId = (body as { sessionId?: unknown })?.sessionId;
  const sessionId =
    typeof rawSessionId === "string" && /^[\w-]{1,100}$/.test(rawSessionId)
      ? rawSessionId
      : `anon-${Date.now().toString(36)}`;

  let messages: UIMessage[];
  try {
    messages = await validateUIMessages({ messages: rawMessages });
  } catch {
    return NextResponse.json(
      { error: "Некорректный формат сообщений" },
      { status: 400 },
    );
  }

  // Берём только последние сообщения и подрезаем слишком длинные тексты
  const trimmed = messages.slice(-MAX_MESSAGES).map((message) => ({
    ...message,
    parts: message.parts.map((part) =>
      part.type === "text"
        ? { ...part, text: part.text.slice(0, MAX_CHARS_PER_MESSAGE) }
        : part,
    ),
  }));

  // В историю для админки пишем только новый вопрос: остальное браузер
  // присылает сам и мог подделать, а ответы Ники сохраняем ниже, из стрима.
  const lastMessage = messages.at(-1);
  if (lastMessage?.role === "user") {
    await saveUserMessage({
      conversationId: sessionId,
      // Сбой авторизации не должен ломать чат: тогда диалог просто гостевой
      userId: (await getSession().catch(() => null))?.user.id ?? null,
      page: refererPath(request),
      message: trimmed.at(-1) ?? lastMessage,
    });
  }

  const modelMessages = await convertToModelMessages(trimmed);

  // Groq не поддерживает reasoning parts в истории сообщений —
  // удаляем их чтобы не получить 400 при fallback с reasoning-модели
  const safeModelMessages: ModelMessage[] = modelMessages.map((msg) => {
    if (!("content" in msg) || !Array.isArray(msg.content)) return msg;
    return {
      ...msg,
      content: msg.content.filter(
        (part: { type?: string }) => part.type !== "reasoning",
      ),
    } as ModelMessage;
  });
  const system = buildSystemPrompt(await fetchPublishedWorkshops());

  // Единая модель с автоматическим переключением на резерв при ошибках.
  // Переключение работает на КАЖДОМ шаге агентного цикла streamText,
  // поэтому rate limit в середине стрима больше не доходит до клиента —
  // запрос прозрачно уходит к следующему провайдеру. Если же недоступны
  // ВСЕ провайдеры, клиент получает вежливый текстовый ответ, а не ошибку.
  const fallbackModel = createFallbackModel(providers, {
    exhaustedMessage: (error) => {
      const status = (error as { statusCode?: unknown })?.statusCode;
      let blob = error instanceof Error ? error.message : String(error ?? "");
      try {
        blob += ` ${JSON.stringify(error)}`;
      } catch {
        // объект ошибки может быть не сериализуемым — игнорируем
      }
      const isRateLimited =
        status === 429 || /rate.?limit|429|temporarily|too many/i.test(blob);
      return isRateLimited
        ? "Сейчас очень много обращений, и я не успеваю отвечать. Пожалуйста, повторите вопрос через минуту — или напишите мастеру в Telegram @Olga_Stariva."
        : "Извините, мне не удалось сформировать ответ. Попробуйте переформулировать вопрос или напишите мастеру в Telegram @Olga_Stariva.";
    },
  });

  const result = streamText({
    model: fallbackModel,
    instructions: system,
    messages: safeModelMessages,
    tools: chatTools as ToolSet,
    stopWhen: isStepCount(5),
    // Чиним некорректные вызовы инструментов локально, без обращения к модели:
    // убираем null-значения, которые модель ставит вместо пропуска поля.
    experimental_repairToolCall: async ({ toolCall, error }) => {
      if (!InvalidToolInputError.isInstance(error)) return null;
      try {
        const parsed = JSON.parse(toolCall.input || "{}");
        let cleaned = stripNulls(parsed);
        // Модель иногда присылает весь вход как null/массив/примитив.
        // Схемы инструментов — всегда объект, поэтому подставляем {}.
        if (
          cleaned === null ||
          typeof cleaned !== "object" ||
          Array.isArray(cleaned)
        ) {
          cleaned = {};
        }
        const repairedInput = JSON.stringify(cleaned);
        if (repairedInput === toolCall.input) return null;
        return { ...toolCall, input: repairedInput };
      } catch {
        return null;
      }
    },
    temperature: 0.6,
    // Переключение между провайдерами берёт на себя createFallbackModel,
    // поэтому внутренние ретраи streamText отключаем.
    maxRetries: 0,
    onError: ({ error }) => {
      console.error("[ai/chat] stream error (all providers failed):", error);
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => {
        console.error("[ai/chat] ui stream error:", error);
        return "Не удалось получить ответ. Попробуйте ещё раз.";
      },
      // Срабатывает и когда посетитель остановил ответ: сохраняем то,
      // что Ника успела написать.
      onEnd: ({ responseMessage }) =>
        saveAssistantMessage({
          conversationId: sessionId,
          message: responseMessage,
        }),
    }),
  });
}
