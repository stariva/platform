"use client";

/**
 * Экран «что-то пошло не так» для error.tsx и global-error.tsx.
 * Ссылка обычная, не next/link: в global-error роутер может быть уже сломан.
 */
export function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-24 text-center bg-white text-near-black">
      <a
        href="/"
        className="font-serif text-2xl uppercase tracking-[0.15em] mb-16 hover:opacity-70 transition-opacity"
      >
        Stariva
      </a>
      <h1 className="font-serif italic text-[clamp(1.75rem,5vw,2.75rem)] leading-tight tracking-tight mb-6">
        Что-то пошло не так
      </h1>
      <p className="text-taupe text-base lg:text-lg max-w-md leading-[1.8] mb-12">
        Страница не загрузилась. Попробуйте ещё раз или вернитесь на главную.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="px-8 py-4 rounded-full bg-near-black text-white font-sans text-xs tracking-widest uppercase hover:bg-dark-grey transition-colors"
        >
          Попробовать ещё раз
        </button>
        <a
          href="/"
          className="px-8 py-4 rounded-full border border-light-grey text-dark-grey font-sans text-xs tracking-widest uppercase hover:border-near-black hover:text-near-black transition-colors"
        >
          На главную
        </a>
      </div>
    </main>
  );
}
