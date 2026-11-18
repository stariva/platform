import { KeepAwake } from "@capacitor-community/keep-awake";
import Hls from "hls.js";
import {
  FlipHorizontal2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Sun,
  X,
} from "lucide-react";
import {
  type PointerEvent,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { z } from "zod";
import { formatTime } from "@/lib/format";
import { readJson, writeJson } from "@/lib/storage";

const STEP_SECONDS = 10;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5] as const;
/** Как часто сохраняем место просмотра, пока видео идёт. */
const SAVE_INTERVAL_MS = 10_000;
const MIRROR_KEY = "stariva:player:mirror";

export interface CraftHlsPlayerHandle {
  /** Перемотать и продолжить с этой секунды (тап по главе). */
  seekTo: (seconds: number) => void;
}

export interface ProgressSnapshot {
  positionSeconds: number;
  durationSeconds: number;
  completed?: boolean;
}

export interface CraftHlsPlayerProps {
  src: { url: string; type: "hls" | "mp4" };
  /**
   * Секунда, с которой начать: то, что сохранил сервер. Читается один раз при
   * монтировании; для другого урока ставьте плееру `key={lessonId}`, иначе
   * прогресс предыдущего урока уйдёт под новым номером.
   */
  startAt?: number;
  /** Ключ локальной копии прогресса, например `slug:lessonId`. */
  progressKey: string;
  /** Сохранить прогресс на сервере. Сбой не должен ломать воспроизведение. */
  onSaveProgress: (progress: ProgressSnapshot) => void;
  /** Текущее время — для подсветки активной главы. */
  onTimeUpdate?: (seconds: number) => void;
  /** Ссылка протухла (401/403): экран должен запросить новую. */
  onSourceExpired?: () => void;
  ref?: Ref<CraftHlsPlayerHandle>;
}

const localProgressSchema = z.object({
  positionSeconds: z.number().finite().nonnegative(),
  savedAt: z.number().finite().nonnegative(),
});
type LocalProgress = z.infer<typeof localProgressSchema>;

type WakeState = "off" | "on" | "unsupported";

/**
 * Плеер для мастер-классов: руки заняты шнуром, поэтому всё управляется
 * крупными кнопками, а экран не гаснет, пока идёт видео.
 *
 * - hls.js, а где нет MSE (iOS WKWebView) — нативный HLS; MP4 как есть;
 * - Wake Lock: Capacitor KeepAwake (в браузере и TMA — Screen Wake Lock API);
 * - A-B Loop: зацикливает фрагмент, на полосе перемотки он закрашен;
 * - шаги ±10 с, скорости 0.5×…1.5× одним тапом, зеркало для левшей;
 * - прогресс: каждые 10 с, на паузе, при сворачивании и выходе.
 */
export function CraftHlsPlayer({
  src,
  startAt = 0,
  progressKey,
  onSaveProgress,
  onTimeUpdate,
  onSourceExpired,
  ref,
}: CraftHlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [mirrored, setMirrored] = useState(false);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [wake, setWake] = useState<WakeState>("off");
  const [failed, setFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Колбэки и состояние для обработчиков, которые не должны пересоздаваться
  const latest = useRef({ onSaveProgress, onTimeUpdate, onSourceExpired });
  latest.current = { onSaveProgress, onTimeUpdate, onSourceExpired };
  const loop = useRef<{ a: number | null; b: number | null }>({
    a: null,
    b: null,
  });
  loop.current = { a: loopA, b: loopB };
  // Секунда, на которую вернуться после смены источника (новая ссылка)
  const resumeAt = useRef<number | null>(null);
  const lastSavedAt = useRef(-1);
  const progress = useRef<ProgressSnapshot | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const nativeRefreshes = useRef(0);

  const captureProgress = useCallback((video: HTMLVideoElement) => {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      progress.current = {
        positionSeconds: video.currentTime,
        durationSeconds: video.duration,
      };
    }
  }, []);
  // Серверная позиция читается один раз: обновление данных урока не должно
  // перезапускать видео
  const startAtRef = useRef(startAt);

  const currentTime = () => videoRef.current?.currentTime ?? 0;

  useEffect(() => {
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === playerRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === playerRef.current) {
      await document.exitFullscreen();
    } else if (playerRef.current?.requestFullscreen) {
      await playerRef.current.requestFullscreen();
    } else {
      const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
      video?.webkitEnterFullscreen?.();
    }
  };

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const max = Number.isFinite(video.duration) ? video.duration : seconds;
    video.currentTime = Math.min(Math.max(0, seconds), max);
    setTime(video.currentTime);
    void video.play().catch(() => {});
  }, []);

  useImperativeHandle(ref, () => ({ seekTo }), [seekTo]);

  /* ---------- Прогресс ---------- */

  const saveProgress = useCallback(
    (completed?: boolean) => {
      const video = videoRef.current;
      if (video) captureProgress(video);
      const current = progress.current;
      if (!current) return;
      const position = Math.floor(current.positionSeconds);
      // Ничего не сдвинулось — не шлём то же самое
      if (position === lastSavedAt.current && completed === undefined) return;
      lastSavedAt.current = position;
      const snapshot: ProgressSnapshot = {
        positionSeconds: position,
        durationSeconds: Math.floor(current.durationSeconds),
        ...(completed ? { completed } : {}),
      };
      void writeJson(`stariva:progress:${progressKey}`, {
        positionSeconds: position,
        savedAt: Date.now(),
      } satisfies LocalProgress);
      latest.current.onSaveProgress(snapshot);
    },
    [progressKey, captureProgress],
  );

  // Автосохранение раз в 10 секунд, пока видео идёт
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => saveProgress(), SAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [playing, saveProgress]);

  // Сворачивание приложения, закрытие вкладки и выход с экрана
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") saveProgress();
    };
    const onPageHide = () => saveProgress();
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      saveProgress();
    };
  }, [saveProgress]);

  /* ---------- Источник: hls.js или нативный HLS ---------- */

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt — повтор после ошибки
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setFailed(false);
    let cancelled = false;
    let hls: Hls | null = null;
    let onMeta: (() => void) | undefined;
    const onNativeError = () => {
      if (cancelled) return;
      setFailed(true);
      resumeAt.current = video.currentTime;
      if (nativeRefreshes.current < 1) {
        nativeRefreshes.current += 1;
        latest.current.onSourceExpired?.();
      }
    };

    // Сначала то, что сохранил сервер, но если запись не дошла до него,
    // берём локальную копию: так прогресс не теряется без сети
    const start = async () => {
      const wanted =
        resumeAt.current ??
        Math.max(
          startAtRef.current,
          (
            await readJson(
              `stariva:progress:${progressKey}`,
              localProgressSchema,
            )
          )?.positionSeconds ?? 0,
        );
      if (cancelled) return;
      resumeAt.current = null;

      onMeta = () => {
        if (wanted > 0 && wanted < video.duration - 1) {
          video.currentTime = wanted;
        }
        video.playbackRate = speedRef.current;
        captureProgress(video);
      };
      video.addEventListener("loadedmetadata", onMeta, { once: true });

      if (src.type === "hls" && Hls.isSupported()) {
        hls = new Hls({ enableWorker: true });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          const status = data.response?.code;
          if (status === 401 || status === 403) {
            resumeAt.current = video.currentTime;
            latest.current.onSourceExpired?.();
          } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT
            ) {
              setFailed(true);
            } else {
              hls?.startLoad();
            }
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
          } else {
            setFailed(true);
          }
        });
        hls.loadSource(src.url);
        hls.attachMedia(video);
      } else {
        // iOS WKWebView без MSE играет HLS сам; MP4 — тем более
        video.addEventListener("error", onNativeError);
        video.src = src.url;
      }
    };
    void start();

    return () => {
      cancelled = true;
      captureProgress(video);
      saveProgress();
      resumeAt.current = progress.current?.positionSeconds ?? null;
      if (onMeta) video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("error", onNativeError);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [src.url, src.type, progressKey, attempt, captureProgress, saveProgress]);

  /* ---------- Wake Lock ---------- */

  const wakeOperation = useRef(0);
  const wakeQueue = useRef(Promise.resolve());

  const releaseWake = useCallback(() => {
    ++wakeOperation.current;
    setWake((state) => (state === "unsupported" ? state : "off"));
    wakeQueue.current = wakeQueue.current.then(async () => {
      try {
        await KeepAwake.allowSleep();
      } catch {
        // нечего отпускать
      }
    });
    return wakeQueue.current;
  }, []);

  const acquireWake = useCallback(() => {
    const operation = ++wakeOperation.current;
    wakeQueue.current = wakeQueue.current.then(async () => {
      if (operation !== wakeOperation.current) return;
      try {
        const { isSupported } = await KeepAwake.isSupported();
        if (operation !== wakeOperation.current) return;
        if (!isSupported) return setWake("unsupported");
        await KeepAwake.keepAwake();
        if (operation !== wakeOperation.current) {
          await KeepAwake.allowSleep();
          return;
        }
        setWake("on");
      } catch {
        if (operation === wakeOperation.current) setWake("unsupported");
      }
    });
    return wakeQueue.current;
  }, []);

  useEffect(() => {
    if (playing) void acquireWake();
    else void releaseWake();
    return () => {
      void releaseWake();
    };
  }, [playing, acquireWake, releaseWake]);

  // Система снимает блокировку, когда приложение уходит в фон: вернуть её
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && playing) {
        void acquireWake();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [playing, acquireWake]);

  /* ---------- Скорость и зеркало ---------- */

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    void readJson(MIRROR_KEY, z.boolean()).then((value) => {
      if (value) setMirrored(true);
    });
  }, []);

  const toggleMirror = () => {
    setMirrored((value) => {
      void writeJson(MIRROR_KEY, !value);
      return !value;
    });
  };

  /* ---------- A-B Loop ---------- */

  // timeupdate приходит раз в ~250 мс — узел «гуляет». Пока видео идёт и
  // отрезок задан, следим за временем каждый кадр и возвращаемся в точку А.
  useEffect(() => {
    if (!playing || loopA === null || loopB === null) return;
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      const { a, b } = loop.current;
      if (video && a !== null && b !== null && video.currentTime >= b) {
        video.currentTime = a;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, loopA, loopB]);

  const markA = () => {
    const t = currentTime();
    setLoopA(t);
    // Точка А после Б делает отрезок пустым — Б начинаем заново
    if (loopB !== null && loopB <= t) setLoopB(null);
  };

  const markB = () => {
    const t = currentTime();
    // Без А отрезком считаем всё от начала видео до этой секунды
    const a = loopA ?? 0;
    if (t - a < 1) return;
    if (loopA === null) setLoopA(0);
    setLoopB(t);
  };

  const clearLoop = () => {
    setLoopA(null);
    setLoopB(null);
  };

  /* ---------- Управление ---------- */

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  };

  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const video = videoRef.current;
    if (!track || !video || !duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    video.currentTime = Math.min(Math.max(0, ratio), 1) * duration;
    setTime(video.currentTime);
  };

  const percent = (seconds: number) =>
    duration > 0 ? `${Math.min(100, (seconds / duration) * 100)}%` : "0%";
  const loopActive = loopA !== null && loopB !== null;

  return (
    <div ref={playerRef} className={fullscreen ? "flex min-h-dvh flex-col justify-center overflow-y-auto bg-bg text-fg" : "bg-bg text-fg"}>
      <div className="relative bg-black">
        <video
          ref={videoRef}
          playsInline
          preload="metadata"
          // Тап по картинке ставит на паузу — не нужно целиться в кнопку
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            void releaseWake();
            setPlaying(false);
            saveProgress();
          }}
          onEnded={() => {
            void releaseWake();
            setPlaying(false);
            saveProgress(true);
          }}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => {
            captureProgress(e.currentTarget);
            setTime(e.currentTarget.currentTime);
            latest.current.onTimeUpdate?.(e.currentTarget.currentTime);
          }}
          className={`mx-auto aspect-video w-full object-contain ${fullscreen ? "max-h-[60dvh]" : "max-h-[34dvh]"} ${
            mirrored ? "scale-x-[-1]" : ""
          }`}
        >
          <track kind="captions" />
        </video>
        <button
          type="button"
          aria-label={fullscreen ? "Выйти из полноэкранного режима" : "На весь экран"}
          onClick={() => void toggleFullscreen().catch(() => {})}
          className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full bg-black/60 text-white"
        >
          {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>

        <div
          role="status"
          className={`absolute top-2 left-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur ${
            wake === "on"
              ? "bg-sage/90 text-white"
              : "bg-black/50 text-white/70"
          }`}
        >
          <Sun className="size-4" aria-hidden />
          {wake === "on"
            ? "Экран не гаснет"
            : wake === "unsupported"
              ? "Экран может погаснуть"
              : "Экран гаснет"}
        </div>

        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
            <p>Не получилось загрузить видео</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="min-h-12 rounded-2xl bg-accent px-6 font-medium text-accent-fg"
            >
              Повторить
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pt-3 pb-4">
        {/* Полоса перемотки: отрезок A-B закрашен, края — маркеры */}
        <div className="flex items-center gap-3 text-xs tabular-nums text-muted">
          <span className="w-12 text-right">{formatTime(time)}</span>
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label="Перемотка"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(time)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              seekFromPointer(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons) seekFromPointer(e);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") seekTo(currentTime() - STEP_SECONDS);
              if (e.key === "ArrowRight") seekTo(currentTime() + STEP_SECONDS);
            }}
            // Высота 48 px — попасть пальцем легко, а видна тонкая линия
            className="relative flex h-12 flex-1 touch-none items-center"
          >
            <div className="relative h-2 w-full rounded-full bg-line">
              {loopA !== null && (
                <div
                  className="absolute inset-y-0 rounded-full bg-accent/35"
                  style={{
                    left: percent(loopA),
                    width:
                      loopB !== null
                        ? `${((loopB - loopA) / (duration || 1)) * 100}%`
                        : "0.5rem",
                  }}
                />
              )}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-accent"
                style={{ width: percent(time) }}
              />
              {loopA !== null && <LoopMarker at={percent(loopA)} label="А" />}
              {loopB !== null && <LoopMarker at={percent(loopB)} label="Б" />}
              <div
                className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg"
                style={{ left: percent(time) }}
              />
            </div>
          </div>
          <span className="w-12">{formatTime(duration)}</span>
        </div>

        {/* Главное: −10 / пауза / +10 — огромные области тапа */}
        <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-3">
          <BigButton
            label="Назад на 10 секунд"
            onClick={() => seekTo(currentTime() - STEP_SECONDS)}
          >
            <RotateCcw className="size-6" aria-hidden />
            <span>−10 с</span>
          </BigButton>
          <button
            type="button"
            aria-label={playing ? "Пауза" : "Играть"}
            onClick={togglePlay}
            className="flex min-h-16 items-center justify-center rounded-2xl bg-accent text-accent-fg active:opacity-80"
          >
            {playing ? (
              <Pause className="size-8" aria-hidden />
            ) : (
              <Play className="size-8" aria-hidden />
            )}
          </button>
          <BigButton
            label="Вперёд на 10 секунд"
            onClick={() => seekTo(currentTime() + STEP_SECONDS)}
          >
            <RotateCw className="size-6" aria-hidden />
            <span>+10 с</span>
          </BigButton>
        </div>

        {/* Зацикливание узла и зеркало */}
        <div className="grid grid-cols-3 gap-3">
          <ToggleButton
            active={loopA !== null}
            onClick={markA}
            label="Поставить точку А"
          >
            А{loopA !== null ? ` ${formatTime(loopA)}` : ""}
          </ToggleButton>
          <ToggleButton
            active={loopB !== null}
            onClick={loopActive ? clearLoop : markB}
            label={loopActive ? "Сбросить повтор" : "Поставить точку Б"}
          >
            {loopActive ? (
              <>
                <X className="size-5" aria-hidden />
                {formatTime(loopB)}
              </>
            ) : (
              "Б"
            )}
          </ToggleButton>
          <ToggleButton
            active={mirrored}
            onClick={toggleMirror}
            label="Отразить видео по горизонтали"
          >
            <FlipHorizontal2 className="size-5" aria-hidden />
            Зеркало
          </ToggleButton>
        </div>

        {/* Скорости — в один тап, без вложенных меню */}
        <div className="grid grid-cols-5 gap-2">
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={speed === value}
              onClick={() => setSpeed(value)}
              className={`min-h-12 rounded-2xl text-sm font-semibold ${
                speed === value
                  ? "bg-sage text-white"
                  : "bg-surface text-fg ring-1 ring-line"
              }`}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoopMarker({ at, label }: { at: string; label: string }) {
  return (
    <div
      className="absolute -top-5 flex -translate-x-1/2 flex-col items-center"
      style={{ left: at }}
    >
      <span className="rounded bg-accent px-1 text-[10px] leading-4 font-bold text-accent-fg">
        {label}
      </span>
    </div>
  );
}

function BigButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl bg-surface text-sm font-semibold text-fg ring-1 ring-line active:bg-line"
    >
      {children}
    </button>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-12 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold ${
        active
          ? "bg-accent text-accent-fg"
          : "bg-surface text-fg ring-1 ring-line"
      }`}
    >
      {children}
    </button>
  );
}
