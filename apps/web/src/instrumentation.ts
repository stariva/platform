// Этот файл запускается Next.js автоматически при старте сервера.
// Все импорты динамические: Node.js-only модули не должны попасть в сборку
// для edge-рантайма.

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
  }
}
