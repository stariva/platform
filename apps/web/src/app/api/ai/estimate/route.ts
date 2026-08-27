import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject, type LanguageModel } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/env";
import {
  calculatePrice,
  describeSelection,
  formatRub,
} from "@/lib/custom-order/pricing";

export const runtime = "nodejs";

const requestSchema = z.object({
  description: z.string().min(3).max(2000),
  productType: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  complexity: z.string().optional(),
  budget: z.string().max(100).optional(),
});

// Структура ответа AI
const estimateSchema = z.object({
  designSummary: z
    .string()
    .describe("Краткое тёплое описание предлагаемого изделия, 1–2 предложения"),
  suggestions: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe("2–4 конкретные дизайн-идеи или рекомендации по материалам"),
  estimatedMin: z.number().describe("Нижняя граница стоимости в рублях"),
  estimatedMax: z.number().describe("Верхняя граница стоимости в рублях"),
  productionDays: z
    .string()
    .describe("Примерный срок изготовления, например «10–14 дней»"),
  note: z
    .string()
    .describe("Короткая заметка о том, что итоговую цену подтвердит мастер"),
});

// ─── Провайдер (тот же роутер, что в chat route) ─────────────────────────────

function getAvailableModels(): Array<{ name: string; model: LanguageModel }> {
  const models: Array<{ name: string; model: LanguageModel }> = [];

  if (env.AI_API_KEY) {
    const router = createOpenAICompatible({
      name: "router",
      apiKey: env.AI_API_KEY,
      baseURL: env.AI_BASE_URL,
    });
    models.push({ name: "router", model: router(env.AI_MODEL) });
  }

  return models;
}

function isFallbackError(error: unknown): boolean {
  // AI SDK: AIAPICallError имеет числовой statusCode
  if (
    error != null &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
  ) {
    const status = (error as { statusCode: number }).statusCode;
    if (status === 429 || status === 502 || status === 503 || status === 529) {
      return true;
    }
  }

  const msg = error instanceof Error ? error.message : String(error ?? "");
  return (
    msg.includes("rate_limit") ||
    msg.includes("Rate limit") ||
    msg.includes("overloaded") ||
    msg.includes("Service Unavailable") ||
    msg.includes("Bad Gateway") ||
    msg.includes("timeout") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ECONNREFUSED")
  );
}

export async function POST(request: NextRequest) {
  const models = getAvailableModels();

  if (models.length === 0) {
    return NextResponse.json(
      { error: "AI-помощник не настроен", code: "not_configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Заполните описание заказа" },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Базовая оценка по правилам — передаём AI как ориентир
  const ruleEstimate = calculatePrice(data);
  const selectionText = describeSelection(data);

  const system =
    "Ты — консультант мастерской макраме Stariva. Изделия плетутся вручную из натурального хлопкового шнура. " +
    "Помогаешь клиенту с индивидуальным заказом: предлагаешь идеи дизайна и ориентировочную стоимость. " +
    "Отвечай только на русском языке, дружелюбно и по делу. " +
    "Не обещай точную цену — это ориентир, итог подтверждает мастер.";

  const prompt = [
    `Запрос клиента: "${data.description}"`,
    selectionText ? `Выбранные параметры: ${selectionText}.` : "",
    data.budget ? `Бюджет клиента: ${data.budget}.` : "",
    ruleEstimate
      ? `Базовый расчёт по прайсу мастерской: ${formatRub(ruleEstimate.min)}–${formatRub(ruleEstimate.max)}. Используй его как ориентир, можешь скорректировать с учётом сложности из описания.`
      : "Параметры не выбраны — оцени по описанию, типичный диапазон для макраме 1500–8000 ₽.",
  ]
    .filter(Boolean)
    .join("\n");

  let lastError: unknown;

  for (const { name, model } of models) {
    try {
      const { object } = await generateObject({
        model,
        schema: estimateSchema,
        instructions: system,
        prompt,
        maxRetries: 0,
      });

      return NextResponse.json(object);
    } catch (error) {
      lastError = error;
      console.error(`[ai/estimate] provider "${name}" failed:`, error);

      if (isFallbackError(error)) {
        const isLast = name === models[models.length - 1]?.name;
        if (!isLast) {
          console.warn(
            `[ai/estimate] falling back from "${name}" to next provider`,
          );
          continue;
        }
      }

      break;
    }
  }

  console.error("[ai/estimate] all providers failed, last error:", lastError);
  return NextResponse.json(
    { error: "Не удалось получить ответ AI. Попробуйте позже." },
    { status: 502 },
  );
}
