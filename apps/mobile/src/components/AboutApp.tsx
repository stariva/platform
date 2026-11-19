import { App } from "@capacitor/app";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Primitives";
import { isNativeApp } from "@/lib/updates";
import type { AppUpdate } from "@/lib/use-app-update";

interface ShellInfo {
  version: string;
  build: string;
}

/**
 * Блок «О приложении» в профиле. Версия бандла — то, что человек видит на
 * экране: её подставляет Vite из `package.json` при сборке. Оболочку (APK/IPA)
 * показываем рядом, только в приложении: по ней поддержка понимает, какая
 * сборка установлена, даже если веб-часть обновилась по воздуху.
 */
export function AboutApp({ update }: { update: AppUpdate }) {
  const [shell, setShell] = useState<ShellInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isNativeApp) return;
    let cancelled = false;
    void App.getInfo()
      .then((info) => {
        if (!cancelled) setShell({ version: info.version, build: info.build });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const check = async () => {
    setChecked(false);
    const result = await update.check();
    if (result) setChecked(true);
  };

  return (
    <section aria-labelledby="about-app">
      <h2 id="about-app" className="section-title">
        О приложении
      </h2>
      <div className="mt-4 rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-1)] ring-1 ring-line">
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">Версия</dt>
            <dd className="font-semibold tabular-nums">{__APP_VERSION__}</dd>
          </div>
          {shell && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">Оболочка</dt>
              <dd className="font-semibold tabular-nums">
                {shell.version} ({shell.build})
              </dd>
            </div>
          )}
        </dl>

        {isNativeApp && (
          <>
            <Button
              variant="secondary"
              className="mt-4 w-full"
              disabled={update.busy}
              onClick={() => void check()}
            >
              {update.busy ? "Проверяем…" : "Проверить обновления"}
            </Button>
            <div role="status" aria-live="polite">
              {update.error ? (
                <p className="mt-3 text-danger text-sm">{update.error}</p>
              ) : checked ? (
                update.status.kind === "none" ? (
                  <p className="mt-3 text-muted text-sm">
                    Установлена последняя версия.
                  </p>
                ) : (
                  <p className="mt-3 text-muted text-sm">
                    Доступна версия {update.status.release.version} — обновите
                    приложение кнопкой внизу экрана.
                  </p>
                )
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
