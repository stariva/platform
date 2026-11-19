import { KeepAwake } from "@capacitor-community/keep-awake";
import Hls from "hls.js";
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Sun,
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
import {
  nativeHlsQualities,
  type QualityOption,
  qualityLabel,
} from "@/lib/video-quality";

const STEP_SECONDS = 10;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5] as const;
/** Как часто сохраняем место просмотра, пока видео идёт. */
const SAVE_INTERVAL_MS = 10_000;

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
 * - шаги ±10 с и скорости 0.5×…1.5× одним тапом;
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
  const hlsRef = useRef<Hls | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [wake, setWake] = useState<WakeState>("off");
  const [failed, setFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [quality, setQuality] = useState<number | "auto">("auto");
  const [qualityOpen, setQualityOpen] = useState(false);

  // Колбэки и состояние для обработчиков, которые не должны пересоздаваться
  const latest = useRef({ onSaveProgress, onTimeUpdate, onSourceExpired });
  latest.current = { onSaveProgress, onTimeUpdate, onSourceExpired };
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
    const updateFullscreen = () =>
      setFullscreen(document.fullscreenElement === playerRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === playerRef.current) {
      await document.exitFullscreen();
      return;
    }

    if (document.fullscreenEnabled && playerRef.current?.requestFullscreen) {
      try {
        await playerRef.current.requestFullscreen();
        return;
      } catch {
        // WKWebView может объявлять API, но запрещать fullscreen для div.
      }
    }

    const video = videoRef.current as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null;
    video?.webkitEnterFullscreen?.();
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
    setQualities([]);
    setQuality("auto");
    setQualityOpen(false);
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
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled || !hls) return;
          setQualities(
            hls.levels
              .map((level, index) => ({
                index,
                label: qualityLabel(level.width, level.height),
              }))
              .sort(
                (a, b) =>
                  Number.parseInt(b.label, 10) - Number.parseInt(a.label, 10),
              ),
          );
        });
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
        if (src.type === "hls" && src.url.includes("master.m3u8")) {
          void fetch(src.url)
            .then((response) => (response.ok ? response.text() : ""))
            .then((playlist) => {
              if (!cancelled) {
                setQualities(
                  nativeHlsQualities(
                    playlist,
                    new URL(src.url, window.location.href).href,
                  ),
                );
              }
            })
            .catch(() => {});
        }
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
      hlsRef.current = null;
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

  /* ---------- Скорость ---------- */

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  const selectQuality = (selected: number | "auto") => {
    setQuality(selected);
    setQualityOpen(false);
    if (hlsRef.current) {
      hlsRef.current.nextLevel = selected === "auto" ? -1 : selected;
      return;
    }

    const video = videoRef.current;
    const url =
      selected === "auto"
        ? src.url
        : qualities.find((option) => option.index === selected)?.url;
    if (!video || !url || video.src === url) return;
    const position = video.currentTime;
    const wasPlaying = !video.paused;
    video.addEventListener(
      "loadedmetadata",
      () => {
        if (Number.isFinite(video.duration)) {
          video.currentTime = Math.min(
            position,
            Math.max(0, video.duration - 0.1),
          );
        }
        video.playbackRate = speedRef.current;
        if (wasPlaying) void video.play().catch(() => {});
      },
      { once: true },
    );
    video.src = url;
    video.load();
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

  return (
    <div
      ref={playerRef}
      className={
        fullscreen
          ? "relative h-dvh w-full overflow-hidden bg-black text-white"
          : "bg-bg text-fg"
      }
    >
      <div
        className={
          fullscreen ? "absolute inset-0 bg-black" : "relative bg-black"
        }
      >
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
          className={`mx-auto w-full object-contain ${fullscreen ? "h-full" : "aspect-video max-h-[34dvh]"}`}
        >
          <track kind="captions" />
        </video>
        <button
          type="button"
          aria-label={
            fullscreen ? "Выйти из полноэкранного режима" : "На весь экран"
          }
          onClick={() => void toggleFullscreen()}
          className="absolute top-[max(0.5rem,env(safe-area-inset-top))] right-[max(0.5rem,env(safe-area-inset-right))] flex size-11 items-center justify-center rounded-full bg-black/60 text-white"
        >
          {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>

        <div
          role="status"
          className={`absolute top-[max(0.5rem,env(safe-area-inset-top))] left-[max(0.5rem,env(safe-area-inset-left))] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur ${
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
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
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

      <div
        className={
          fullscreen
            ? "absolute inset-x-0 bottom-0 z-10 space-y-2 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-4 pt-8 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            : "space-y-3 px-4 pt-3 pb-4"
        }
      >
        {/* Полоса перемотки */}
        <div
          className={`flex items-center gap-3 text-xs tabular-nums ${fullscreen ? "text-white" : "text-muted"}`}
        >
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
            <div
              className={`relative h-2 w-full rounded-full ${fullscreen ? "bg-white/40" : "bg-line"}`}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-accent"
                style={{ width: percent(time) }}
              />
              <div
                className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ${fullscreen ? "bg-white" : "bg-fg"}`}
                style={{ left: percent(time) }}
              />
            </div>
          </div>
          <span className="w-12">{formatTime(duration)}</span>
        </div>

        {/* Главное: −10 / пауза / +10 — огромные области тапа */}
        <div
          className={`grid grid-cols-[1fr_1.4fr_1fr] gap-3 ${fullscreen ? "mx-auto max-w-sm" : ""}`}
        >
          <BigButton
            label="Назад на 10 секунд"
            onClick={() => seekTo(currentTime() - STEP_SECONDS)}
            compact={fullscreen}
          >
            <RotateCcw className="size-6" aria-hidden />
            <span>−10 с</span>
          </BigButton>
          <button
            type="button"
            aria-label={playing ? "Пауза" : "Играть"}
            onClick={togglePlay}
            className={`flex items-center justify-center rounded-2xl bg-accent text-accent-fg active:opacity-80 ${fullscreen ? "min-h-12" : "min-h-16"}`}
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
            compact={fullscreen}
          >
            <RotateCw className="size-6" aria-hidden />
            <span>+10 с</span>
          </BigButton>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Качество видео"
            aria-expanded={qualityOpen}
            disabled={qualities.length < 2 || duration === 0}
            onClick={() => setQualityOpen((open) => !open)}
            className={`flex min-h-12 w-full items-center justify-center rounded-2xl px-3 text-sm font-semibold disabled:opacity-60 ${fullscreen ? "bg-white/20 text-white" : "bg-surface text-fg ring-1 ring-line"}`}
          >
            Качество ·{" "}
            {src.type === "mp4"
              ? "Исходное"
              : quality === "auto"
                ? "Авто"
                : (qualities.find((option) => option.index === quality)
                    ?.label ?? "Авто")}
          </button>
          {qualityOpen && (
            <div
              className={`absolute right-0 bottom-full z-20 mb-2 w-full min-w-36 overflow-hidden rounded-2xl p-1 shadow-lg ${fullscreen ? "bg-neutral-900 text-white" : "bg-surface text-fg ring-1 ring-line"}`}
            >
              {[{ index: "auto" as const, label: "Авто" }, ...qualities].map(
                (option) => (
                  <button
                    key={option.index}
                    type="button"
                    aria-pressed={quality === option.index}
                    onClick={() => selectQuality(option.index)}
                    className={`min-h-11 w-full rounded-xl px-3 text-left text-sm ${quality === option.index ? "bg-accent font-semibold text-accent-fg" : "active:bg-black/10"}`}
                  >
                    {option.label}
                  </button>
                ),
              )}
            </div>
          )}
        </div>

        {/* Скорости — в один тап, без вложенных меню */}
        <div className={`grid grid-cols-5 gap-2 ${fullscreen ? "hidden" : ""}`}>
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

function BigButton({
  label,
  onClick,
  children,
  compact = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl text-sm font-semibold ${compact ? "min-h-12 bg-white/20 text-white active:bg-white/30" : "min-h-16 bg-surface text-fg ring-1 ring-line active:bg-line"}`}
    >
      {children}
    </button>
  );
}
