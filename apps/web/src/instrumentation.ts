// ─── OpenTelemetry + Langfuse instrumentation ────────────────────────────────
// Этот файл запускается Next.js автоматически при старте сервера.
// Инициализирует трассировку: все вызовы streamText/generateObject с опцией
// telemetry автоматически попадают в Langfuse (трейсы, tool-вызовы, latency).
//
// Схема:
//   @ai-sdk/otel (LegacyOpenTelemetry)
//     → перехватывает телemetry-события AI SDK
//     → создаёт OTel-спаны через глобальный TracerProvider
//   NodeTracerProvider + LangfuseSpanProcessor
//     → принимает спаны и отправляет их в Langfuse
//
// ВАЖНО: используем NodeTracerProvider напрямую, а не registerOTel из @vercel/otel,
// так как @vercel/otel не поддерживает OpenTelemetry JS SDK v2, на котором
// основаны @langfuse/otel и @langfuse/tracing.
// https://github.com/vercel/otel/issues/154
//
// Все импорты динамические: Turbopack не умеет резолвить CJS-пакеты
// (@langfuse/otel) и Node.js-only модули в момент сборки.

export let langfuseSpanProcessor: { forceFlush(): Promise<void> } | undefined;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerTelemetry } = await import("ai");
    const { LegacyOpenTelemetry } = await import("@ai-sdk/otel");
    const { LangfuseSpanProcessor } = await import("@langfuse/otel");
    const { NodeTracerProvider } = await import(
      "@opentelemetry/sdk-trace-node"
    );

    const processor = new LangfuseSpanProcessor();
    langfuseSpanProcessor = processor;

    const tracerProvider = new NodeTracerProvider({
      spanProcessors: [processor],
    });

    // Регистрируем провайдер первым — LegacyOpenTelemetry будет использовать
    // уже готовый глобальный трейсер при создании спанов.
    tracerProvider.register();

    // Подключаем AI SDK к OTel: теперь telemetry: {} в streamText/generateObject
    // автоматически создаёт спаны, которые попадают в LangfuseSpanProcessor.
    registerTelemetry(new LegacyOpenTelemetry());
  }
}
