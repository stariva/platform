import { Download, LoaderCircle } from "lucide-react";
import type { AppUpdate } from "@/lib/use-app-update";

/**
 * Плашка внизу экрана: «Доступна новая версия». Пока обновлять нечего, её нет.
 * Бандл ставится по кнопке, а не молча: перезагрузка WebView оборвала бы урок.
 */
export function UpdateBanner({ update }: { update: AppUpdate }) {
  const { status, busy, error, apply } = update;
  if (status.kind === "none") return null;

  const isNative = status.kind === "native";
  const title = isNative
    ? "Нужна новая версия приложения"
    : `Доступна версия ${status.release.version}`;
  const text = isNative
    ? status.url
      ? "Эта версия слишком старая, чтобы обновиться изнутри. Скачайте новую."
      : "Эта версия слишком старая, чтобы обновиться изнутри. Обновите приложение в магазине."
    : status.release.releaseNotes;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 border-line border-t bg-surface p-4 shadow-lg"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">{title}</p>
          {text ? (
            <p className="line-clamp-3 whitespace-pre-line text-muted text-sm">
              {text}
            </p>
          ) : null}
          {error ? <p className="text-accent text-sm">{error}</p> : null}
        </div>
        {isNative && !status.url ? null : (
          <button
            type="button"
            onClick={() => void apply()}
            disabled={busy}
            className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-5 font-medium text-accent-fg disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            {busy ? "Подождите…" : isNative ? "Скачать" : "Обновить"}
          </button>
        )}
      </div>
    </div>
  );
}
