// Глобальные типы для сторонних скриптов

declare global {
  interface Window {
    // Яндекс Метрика
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

export {};
