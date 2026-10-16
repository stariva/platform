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

// Серверные ошибки (рендер, route handlers, server actions) уходят в PostHog.
// Динамический импорт: posthog-node нужен только в Node.js-рантайме.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: {
    routerKind?: string;
    routePath?: string;
    routeType?: string;
    renderSource?: string;
  },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportRequestError } = await import("@/lib/server-errors");
  await reportRequestError(error, request, context);
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initServerErrorReporting } = await import("@/lib/server-errors");
    initServerErrorReporting();
    // Persistent k3s server; database leases coordinate replicas/restarts.
    if (
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PHASE !== "phase-production-build"
    ) {
      const { startOrderRetryWorker, warnIfOrderEmailMissing } = await import(
        "@/lib/custom-order/inbox"
      );
      warnIfOrderEmailMissing();
      startOrderRetryWorker();
    }
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
