import { useCallback, useEffect, useRef, useState } from "react";
import type { UpdateStatus } from "@/lib/update-decision";
import {
  checkForUpdate,
  installBundle,
  isNativeApp,
  markAppReady,
  onAppResume,
  openNativeUpdate,
} from "@/lib/updates";

export interface AppUpdate {
  status: UpdateStatus;
  /** Идёт проверка или установка. */
  busy: boolean;
  /** Что пошло не так при ручной проверке или установке; null — всё хорошо. */
  error: string | null;
  /** Кнопка «Проверить обновления»: в отличие от фоновой, показывает ошибки. */
  check: () => Promise<UpdateStatus | null>;
  /** Кнопка «Обновить»: ставит бандл или ведёт за новой оболочкой. */
  apply: () => Promise<void>;
}

/**
 * Обновление приложения: сообщает плагину, что бандл жив, проверяет релиз при
 * запуске и при возвращении в приложение. Фоновая проверка молчит о сбоях сети
 * (в метро связи может не быть), ручная — нет.
 */
export function useAppUpdate(): AppUpdate {
  const [status, setStatus] = useState<UpdateStatus>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const run = useCallback(
    async (silent: boolean): Promise<UpdateStatus | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        const next = await checkForUpdate();
        setStatus(next);
        setError(null);
        return next;
      } catch {
        if (!silent) {
          setError("Не удалось проверить обновления. Проверьте интернет.");
        }
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isNativeApp) return;
    void markAppReady();
    void run(true);
    let stop: (() => void) | undefined;
    let unmounted = false;
    void onAppResume(() => void run(true)).then((off) => {
      if (unmounted) off();
      else stop = off;
    });
    return () => {
      unmounted = true;
      stop?.();
    };
  }, [run]);

  const check = useCallback(() => run(false), [run]);

  const apply = useCallback(async () => {
    const current = status;
    if (current.kind === "none" || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (current.kind === "bundle") await installBundle(current.release);
      else if (current.url) await openNativeUpdate(current.url);
    } catch {
      setError("Не удалось обновиться. Проверьте интернет и повторите.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [status]);

  return { status, busy, error, check, apply };
}
