"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Keyboard,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  RotateCcw,
  Settings,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { z } from "zod";

interface VideoPlayerProps {
  slug: string;
  lessonId: string;
  /** Сохранённая позиция (секунды) для продолжения с места. */
  initialPosition: number;
  /** Был ли урок уже отмечен как пройденный. */
  initialCompleted?: boolean;
  lessonTitle: string;
  /** Подпись над названием, например «Урок 2 из 8». */
  lessonLabel: string;
  nextLesson: { id: string; title: string } | null;
  /** Ссылка на страницу мастер-класса. */
  courseHref: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SEEK_STEP = 10;
const CONTROLS_HIDE_MS = 2800;
const AUTONEXT_SECONDS = 8;
const MAX_SOURCE_RETRIES = 2;

const PREFS_KEY = "stariva-player-prefs";
// Флаг «запустить сразу» при автопереходе к следующему уроку
const AUTOPLAY_KEY = "stariva-player-autoplay";

interface PlayerPrefs {
  volume: number;
  muted: boolean;
  rate: number;
  autoNext: boolean;
}

const DEFAULT_PREFS: PlayerPrefs = {
  volume: 1,
  muted: false,
  rate: 1,
  autoNext: true,
};

const playerPrefsSchema = z.object({
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  rate: z.number().refine((rate) => SPEEDS.includes(rate)),
  autoNext: z.boolean(),
});

function readPrefs(): PlayerPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const result = playerPrefsSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: PlayerPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* приватный режим — настройки просто не запомнятся */
  }
}

function formatTime(total: number): string {
  if (!Number.isFinite(total) || total < 0) total = 0;
  const s = Math.floor(total % 60);
  const m = Math.floor((total / 60) % 60);
  const h = Math.floor(total / 3600);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function formatRate(rate: number): string {
  return rate === 1 ? "Обычная" : `${String(rate).replace(".", ",")}×`;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};
type WebkitVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

function getFullscreenElement(): Element | null {
  const d = document as WebkitDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

interface Flash {
  id: number;
  icon: ReactNode;
  label?: string;
  /** Сторона для двойного тапа: индикатор показывается у края. */
  side?: "left" | "right";
}

export function VideoPlayer({
  slug,
  lessonId,
  initialPosition,
  initialCompleted = false,
  lessonTitle,
  lessonLabel,
  nextLesson,
  courseHref,
}: VideoPlayerProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Источник
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const retriesRef = useRef(0);
  const pendingSeekRef = useRef<number | null>(initialPosition || null);
  const initialResumePendingRef = useRef(true);
  const resumePlayRef = useRef(false);

  // Состояние воспроизведения
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [ended, setEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);

  // Настройки
  const [prefs, setPrefs] = useState<PlayerPrefs>(DEFAULT_PREFS);
  const prefsLoadedRef = useRef(false);

  // Интерфейс
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsView, setSettingsView] = useState<null | "main" | "speed">(
    null,
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [resumeNotice, setResumeNotice] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const hideTimerRef = useRef<number | undefined>(undefined);
  const flashIdRef = useRef(0);
  const lastSavedRef = useRef(0);
  const currentTimeRef = useRef(initialPosition);
  const durationRef = useRef(0);
  const completedRef = useRef(initialCompleted);
  const pointerTypeRef = useRef<string>("mouse");
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<number | undefined>(undefined);

  // ── Подписанная ссылка на видео ─────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken намеренно перезапрашивает ссылку
  useEffect(() => {
    let active = true;
    setError(null);
    fetch(
      `/api/video/sign?slug=${encodeURIComponent(slug)}&lessonId=${encodeURIComponent(lessonId)}`,
    )
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || "Не удалось загрузить видео");
        }
        return r.json();
      })
      .then((d) => {
        if (active) setSrc(d.url);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [slug, lessonId, reloadToken]);

  // ── Настройки из localStorage ───────────────────────────────────
  useEffect(() => {
    setPrefs(readPrefs());
    prefsLoadedRef.current = true;
    setPipSupported(
      typeof document !== "undefined" &&
        "pictureInPictureEnabled" in document &&
        document.pictureInPictureEnabled,
    );
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = prefs.volume;
    video.muted = prefs.muted;
    video.playbackRate = prefs.rate;
    if (prefsLoadedRef.current) writePrefs(prefs);
  }, [prefs]);

  const updatePrefs = useCallback((patch: Partial<PlayerPrefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
  }, []);

  // ── Сохранение прогресса ────────────────────────────────────────
  const saveProgress = useCallback(
    (positionSeconds: number, durationSeconds: number, completed?: boolean) => {
      // keepalive — чтобы запрос успел уйти при закрытии вкладки
      fetch("/api/video/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          slug,
          lessonId,
          positionSeconds,
          durationSeconds,
          completed,
        }),
      }).catch(() => {
        /* тихо игнорируем сетевые сбои сохранения прогресса */
      });
    },
    [slug, lessonId],
  );

  const saveNow = useCallback(() => {
    const position = currentTimeRef.current;
    const videoDuration = durationRef.current;
    if (videoDuration && !completedRef.current) {
      lastSavedRef.current = position;
      saveProgress(position, videoDuration);
    }
  }, [saveProgress]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") saveNow();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", saveNow);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", saveNow);
      saveNow();
    };
  }, [saveNow]);

  // ── Управление ──────────────────────────────────────────────────
  const showFlash = useCallback((f: Omit<Flash, "id">) => {
    flashIdRef.current += 1;
    setFlash({ ...f, id: flashIdRef.current });
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video?.duration) return;
    video.currentTime = clamp(time, 0, video.duration);
    currentTimeRef.current = video.currentTime;
    setCurrentTime(video.currentTime);
  }, []);

  const seekBy = useCallback(
    (delta: number, side?: Flash["side"]) => {
      const video = videoRef.current;
      if (!video?.duration) return;
      seekTo(video.currentTime + delta);
      showFlash({
        icon:
          delta < 0 ? (
            <RotateCcw className="size-7" />
          ) : (
            <RotateCcw className="size-7 -scale-x-100" />
          ),
        label: `${delta > 0 ? "+" : "−"}${Math.abs(delta)} сек`,
        side,
      });
    },
    [seekTo, showFlash],
  );

  const setVolume = useCallback(
    (volume: number) => {
      const v = clamp(Math.round(volume * 100) / 100, 0, 1);
      updatePrefs({ volume: v, muted: v === 0 });
    },
    [updatePrefs],
  );

  const toggleMute = useCallback(() => {
    setPrefs((p) => {
      // Включаем звук на нулевой громкости — возвращаем разумный уровень
      if (p.muted || p.volume === 0) {
        return { ...p, muted: false, volume: p.volume || 0.5 };
      }
      return { ...p, muted: true };
    });
  }, []);

  const setRate = useCallback(
    (rate: number) => {
      updatePrefs({ rate });
      showFlash({
        icon: <Gauge className="size-7" />,
        label: `Скорость ${formatRate(rate).toLowerCase()}`,
      });
    },
    [updatePrefs, showFlash],
  );

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current as WebkitElement | null;
    const video = videoRef.current as WebkitVideo | null;
    if (!container) return;
    const d = document as WebkitDocument;
    if (getFullscreenElement()) {
      (d.exitFullscreen ?? d.webkitExitFullscreen)?.call(d)?.catch(() => {});
      return;
    }
    if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => {});
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    } else if (video?.webkitEnterFullscreen) {
      // iPhone: полноэкранный режим доступен только для самого <video>
      video.webkitEnterFullscreen();
    }
  }, []);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      toast.error("Режим «картинка в картинке» недоступен");
    }
  }, []);

  const goNext = useCallback(() => {
    if (!nextLesson) return;
    try {
      sessionStorage.setItem(AUTOPLAY_KEY, "1");
    } catch {
      /* без автозапуска — не страшно */
    }
    router.push(`/account/workshops/${slug}/${nextLesson.id}`);
  }, [nextLesson, router, slug]);

  // ── Автоскрытие панели ──────────────────────────────────────────
  const menusOpen = settingsView !== null || helpOpen;
  const keepControls = !playing || menusOpen || scrubbing || ended;

  const pokeControls = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(
      () => setControlsVisible(false),
      CONTROLS_HIDE_MS,
    );
  }, []);

  useEffect(() => {
    if (keepControls) {
      window.clearTimeout(hideTimerRef.current);
      setControlsVisible(true);
    } else {
      pokeControls();
    }
  }, [keepControls, pokeControls]);

  useEffect(
    () => () => {
      window.clearTimeout(hideTimerRef.current);
      window.clearTimeout(tapTimerRef.current);
    },
    [],
  );

  const showControls = controlsVisible || keepControls;

  // ── Полноэкранный режим / PiP ───────────────────────────────────
  useEffect(() => {
    const onChange = () =>
      setFullscreen(getFullscreenElement() === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: слушатели нужно перевешивать при смене src (новый <video>)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnter = () => setPip(true);
    const onLeave = () => setPip(false);
    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);
    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, [src]);

  // ── Горячие клавиши ─────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const container = containerRef.current;
      if (!container) return;
      // Реагируем, только если фокус на странице или внутри плеера
      const inPlayer = target ? container.contains(target) : false;
      if (!inPlayer && target !== document.body) return;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }
      // Пробел/Enter на кнопке — пусть сработает сама кнопка
      if (
        target instanceof HTMLButtonElement &&
        (e.key === " " || e.key === "Enter")
      ) {
        return;
      }

      const video = videoRef.current;
      let handled = true;
      switch (e.key) {
        case " ":
        case "k":
        case "л":
          togglePlay();
          showFlash({
            icon: video?.paused ? (
              <Pause className="size-8 fill-current" />
            ) : (
              <Play className="size-8 fill-current" />
            ),
          });
          break;
        case "ArrowLeft":
          seekBy(-5);
          break;
        case "ArrowRight":
          seekBy(5);
          break;
        case "j":
        case "о":
          seekBy(-SEEK_STEP);
          break;
        case "l":
        case "д":
          seekBy(SEEK_STEP);
          break;
        case "ArrowUp":
        case "ArrowDown": {
          const base = prefs.muted ? 0 : prefs.volume;
          const v = clamp(base + (e.key === "ArrowUp" ? 0.05 : -0.05), 0, 1);
          setVolume(v);
          showFlash({
            icon:
              v === 0 ? (
                <VolumeX className="size-7" />
              ) : (
                <Volume2 className="size-7" />
              ),
            label: `Громкость ${Math.round(v * 100)}%`,
          });
          break;
        }
        case "m":
        case "ь":
          toggleMute();
          showFlash({
            icon:
              prefs.muted || prefs.volume === 0 ? (
                <Volume2 className="size-7" />
              ) : (
                <VolumeX className="size-7" />
              ),
            label:
              prefs.muted || prefs.volume === 0 ? "Звук включён" : "Без звука",
          });
          break;
        case "f":
        case "а":
          toggleFullscreen();
          break;
        case "i":
        case "ш":
          if (pipSupported) void togglePip();
          break;
        case ">":
        case "Ю": {
          const i = SPEEDS.indexOf(prefs.rate);
          setRate(SPEEDS[Math.min(SPEEDS.length - 1, i + 1)] ?? 1);
          break;
        }
        case "<":
        case "Б": {
          const i = SPEEDS.indexOf(prefs.rate);
          setRate(SPEEDS[Math.max(0, i - 1)] ?? 1);
          break;
        }
        case "N":
        case "Т":
          goNext();
          break;
        case "Home":
          seekTo(0);
          break;
        case "End":
          if (video) seekTo(video.duration);
          break;
        case "?":
          setHelpOpen((o) => !o);
          setSettingsView(null);
          break;
        case "Escape":
          if (menusOpen) {
            setSettingsView(null);
            setHelpOpen(false);
          } else {
            handled = false;
          }
          break;
        default:
          if (/^[0-9]$/.test(e.key) && video?.duration) {
            seekTo((video.duration * Number(e.key)) / 10);
          } else {
            handled = false;
          }
      }
      if (handled) {
        e.preventDefault();
        pokeControls();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    togglePlay,
    seekBy,
    seekTo,
    setVolume,
    toggleMute,
    toggleFullscreen,
    togglePip,
    setRate,
    goNext,
    showFlash,
    pokeControls,
    prefs,
    pipSupported,
    menusOpen,
  ]);

  // ── Обратный отсчёт до следующего урока ─────────────────────────
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      goNext();
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, goNext]);

  // Уведомление «продолжаем с …» исчезает само
  useEffect(() => {
    if (resumeNotice === null) return;
    const t = window.setTimeout(() => setResumeNotice(null), 7000);
    return () => window.clearTimeout(t);
  }, [resumeNotice]);

  // ── События <video> ─────────────────────────────────────────────
  const onLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = prefs.volume;
    video.muted = prefs.muted;
    video.playbackRate = prefs.rate;
    setDuration(video.duration);
    currentTimeRef.current = video.currentTime;
    durationRef.current = video.duration;

    const seek = pendingSeekRef.current;
    pendingSeekRef.current = null;
    const isInitialResume = initialResumePendingRef.current;
    initialResumePendingRef.current = false;
    if (seek !== null && seek > 0 && seek < video.duration - 5) {
      video.currentTime = seek;
      currentTimeRef.current = seek;
      setCurrentTime(seek);
      if (isInitialResume && seek > 15) setResumeNotice(seek);
    }

    let autoplay = resumePlayRef.current;
    resumePlayRef.current = false;
    try {
      if (sessionStorage.getItem(AUTOPLAY_KEY)) {
        sessionStorage.removeItem(AUTOPLAY_KEY);
        autoplay = true;
      }
    } catch {
      /* ignore */
    }
    if (autoplay) video.play().catch(() => {});
  };

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video?.duration) return;
    const now = video.currentTime;
    currentTimeRef.current = now;
    durationRef.current = video.duration;
    if (!scrubbing) setCurrentTime(now);
    // Троттлинг сохранения: не чаще раза в 10 секунд
    if (Math.abs(now - lastSavedRef.current) >= 10) {
      lastSavedRef.current = now;
      saveProgress(now, video.duration);
    }
  };

  const onProgress = () => {
    const video = videoRef.current;
    if (!video) return;
    const { buffered, currentTime: t } = video;
    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= t + 0.5 && buffered.end(i) >= t) {
        setBufferedEnd(buffered.end(i));
        return;
      }
    }
  };

  const onEnded = () => {
    const video = videoRef.current;
    setEnded(true);
    setPlaying(false);
    if (!video) return;
    if (!completedRef.current) {
      completedRef.current = true;
      saveProgress(video.duration, video.duration, true);
      toast.success("Урок пройден");
      router.refresh();
    }
    if (nextLesson && prefs.autoNext) setCountdown(AUTONEXT_SECONDS);
  };

  const onVideoError = () => {
    const video = videoRef.current;
    // Подписанная ссылка могла истечь — перезапрашиваем и продолжаем с того же места
    if (retriesRef.current < MAX_SOURCE_RETRIES) {
      retriesRef.current += 1;
      pendingSeekRef.current = video?.currentTime || currentTime || null;
      resumePlayRef.current = playing;
      setReloadToken((t) => t + 1);
      return;
    }
    setError(
      "Не удалось воспроизвести видео. Проверьте подключение к интернету.",
    );
  };

  const retry = () => {
    retriesRef.current = 0;
    pendingSeekRef.current = currentTime || initialPosition || null;
    setError(null);
    setSrc(null);
    setReloadToken((t) => t + 1);
  };

  const replay = () => {
    setCountdown(null);
    setEnded(false);
    seekTo(0);
    videoRef.current?.play().catch(() => {});
  };

  // ── Клики и тапы по видео ───────────────────────────────────────
  const onSurfacePointerDown = (e: React.PointerEvent) => {
    pointerTypeRef.current = e.pointerType;
    containerRef.current?.focus({ preventScroll: true });
  };

  const onSurfaceClick = (e: React.MouseEvent) => {
    if (menusOpen) {
      setSettingsView(null);
      setHelpOpen(false);
      return;
    }
    if (pointerTypeRef.current === "touch") {
      handleTap(e.clientX);
      return;
    }
    togglePlay();
    showFlash({
      icon: videoRef.current?.paused ? (
        <Pause className="size-8 fill-current" />
      ) : (
        <Play className="size-8 fill-current" />
      ),
    });
  };

  // Телефон: одиночный тап — показать/скрыть панель, двойной у края — перемотка
  const handleTap = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (clientX - rect.left) / rect.width;
    const zone = ratio < 0.35 ? -1 : ratio > 0.65 ? 1 : 0;
    const now = performance.now();
    if (zone !== 0 && now - lastTapRef.current < 300) {
      window.clearTimeout(tapTimerRef.current);
      lastTapRef.current = now;
      seekBy(zone * SEEK_STEP, zone < 0 ? "left" : "right");
      return;
    }
    lastTapRef.current = now;
    window.clearTimeout(tapTimerRef.current);
    tapTimerRef.current = window.setTimeout(() => {
      if (showControls && playing) {
        window.clearTimeout(hideTimerRef.current);
        setControlsVisible(false);
      } else {
        pokeControls();
      }
    }, 300);
  };

  // ── Рендер ──────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="aspect-video rounded-2xl bg-espresso flex flex-col items-center justify-center text-parchment gap-3 px-6 text-center">
        <p className="font-serif text-xl">Видео недоступно</p>
        <p className="text-parchment/60 text-sm max-w-sm">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-parchment text-espresso px-5 py-2 text-sm font-medium hover:bg-parchment/90 transition-colors"
        >
          <RefreshCw className="size-4" />
          Попробовать снова
        </button>
      </div>
    );
  }

  const effectiveVolume = prefs.muted ? 0 : prefs.volume;
  const VolumeIcon =
    effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2;

  return (
    <section
      ref={containerRef}
      tabIndex={-1}
      aria-label={`Видеоплеер: ${lessonTitle}`}
      onMouseMove={pokeControls}
      onMouseLeave={() => {
        if (!keepControls) setControlsVisible(false);
      }}
      className={`group/player relative w-full aspect-video overflow-hidden bg-black text-white select-none outline-none ${
        fullscreen ? "rounded-none" : "rounded-2xl"
      } ${showControls ? "" : "cursor-none"}`}
    >
      {src && (
        // biome-ignore lint/a11y/useMediaCaption: видеоуроки без субтитров на текущем этапе
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="metadata"
          controlsList="nodownload"
          disablePictureInPicture={!pipSupported}
          onContextMenu={(e) => e.preventDefault()}
          onLoadedMetadata={onLoadedMetadata}
          onDurationChange={() => {
            const videoDuration = videoRef.current?.duration || 0;
            durationRef.current = videoDuration;
            setDuration(videoDuration);
          }}
          onTimeUpdate={onTimeUpdate}
          onProgress={onProgress}
          onPlay={() => {
            setPlaying(true);
            setStarted(true);
            setEnded(false);
            setCountdown(null);
            setResumeNotice(null);
          }}
          onPause={() => {
            const video = videoRef.current;
            if (video) {
              currentTimeRef.current = video.currentTime;
              durationRef.current = video.duration;
            }
            setPlaying(false);
            saveNow();
          }}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => {
            retriesRef.current = 0;
            setWaiting(false);
          }}
          onCanPlay={() => setWaiting(false)}
          onSeeked={onProgress}
          onEnded={onEnded}
          onError={onVideoError}
          className="absolute inset-0 size-full object-contain"
        />
      )}

      {/* Поверхность для кликов/тапов */}
      <button
        type="button"
        aria-label={playing ? "Пауза" : "Смотреть"}
        tabIndex={-1}
        onPointerDown={onSurfacePointerDown}
        onClick={onSurfaceClick}
        onDoubleClick={() => {
          if (pointerTypeRef.current !== "touch") toggleFullscreen();
        }}
        className="absolute inset-0 size-full cursor-[inherit] outline-none"
      />

      {/* Загрузка */}
      {(!src || (waiting && !ended)) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="size-12 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {/* Большая кнопка до первого запуска */}
      {src && !started && !waiting && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 pb-8 sm:pb-0 bg-gradient-to-t from-black/60 via-black/20 to-black/30">
          <div className="flex size-14 sm:size-20 items-center justify-center rounded-full bg-white/95 text-espresso shadow-2xl transition-transform duration-300 group-hover/player:scale-105">
            <Play className="size-8 translate-x-0.5 fill-current" />
          </div>
          <p className="hidden text-sm text-white/80 sm:block">
            {initialPosition > 15 && initialPosition < duration - 5
              ? `Продолжить с ${formatTime(initialPosition)}`
              : "Смотреть урок"}
          </p>
        </div>
      )}

      {/* Индикатор действий (перемотка, громкость, пауза) */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.id}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.18 }}
            onAnimationComplete={() =>
              window.setTimeout(
                () => setFlash((f) => (f?.id === flash.id ? null : f)),
                450,
              )
            }
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 ${
              flash.side === "left"
                ? "left-[12%]"
                : flash.side === "right"
                  ? "right-[12%]"
                  : "left-1/2 -translate-x-1/2"
            }`}
          >
            <div className="flex size-16 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm">
              {flash.icon}
            </div>
            {flash.label && (
              <span className="rounded-full bg-black/55 px-3 py-1 text-xs font-medium tabular-nums backdrop-blur-sm">
                {flash.label}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Верхняя панель: название урока */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-4 pt-3 pb-10 sm:px-6 sm:pt-4 transition-opacity duration-300 ${
          showControls && started ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">
          {lessonLabel}
        </p>
        <p className="truncate font-serif text-base sm:text-lg">
          {lessonTitle}
        </p>
      </div>

      {/* «Вы остановились на …» */}
      <AnimatePresence>
        {resumeNotice !== null && started && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute left-3 bottom-20 sm:left-5 sm:bottom-24 flex items-center gap-3 rounded-full bg-black/75 py-1.5 pl-4 pr-1.5 text-xs sm:text-sm backdrop-blur-md"
          >
            <span className="text-white/80">
              Продолжаем с {formatTime(resumeNotice)}
            </span>
            <button
              type="button"
              onClick={() => {
                seekTo(0);
                setResumeNotice(null);
              }}
              className="rounded-full bg-white/15 px-3 py-1 font-medium hover:bg-white/25 transition-colors"
            >
              Начать сначала
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Экран окончания урока */}
      {ended && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm px-6">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            {nextLesson ? (
              <>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">
                  {countdown !== null
                    ? `Следующий урок через ${countdown} сек`
                    : "Следующий урок"}
                </p>
                <p className="font-serif text-xl sm:text-2xl">
                  {nextLesson.title}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={goNext}
                    className="relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-5 py-2.5 text-sm font-medium text-espresso hover:bg-white/90 transition-colors"
                  >
                    <SkipForward className="size-4 fill-current" />
                    Смотреть
                  </button>
                  {countdown !== null ? (
                    <button
                      type="button"
                      onClick={() => setCountdown(null)}
                      className="rounded-full bg-white/10 px-5 py-2.5 text-sm hover:bg-white/20 transition-colors"
                    >
                      Отмена
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={replay}
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm hover:bg-white/20 transition-colors"
                    >
                      <RotateCcw className="size-4" />
                      Пересмотреть
                    </button>
                  )}
                </div>
                {countdown !== null && (
                  <div className="h-0.5 w-40 overflow-hidden rounded-full bg-white/15">
                    <div
                      key={AUTONEXT_SECONDS}
                      className="h-full bg-white"
                      style={{
                        width: `${((AUTONEXT_SECONDS - countdown) / AUTONEXT_SECONDS) * 100}%`,
                        transition: "width 1s linear",
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex size-12 items-center justify-center rounded-full bg-white/10">
                  <Check className="size-6" />
                </div>
                <p className="font-serif text-xl sm:text-2xl">
                  Это был последний урок
                </p>
                <p className="text-sm text-white/60">
                  Поздравляем — мастер-класс пройден до конца!
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={replay}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm hover:bg-white/20 transition-colors"
                  >
                    <RotateCcw className="size-4" />
                    Пересмотреть
                  </button>
                  <Link
                    href={courseHref}
                    className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-espresso hover:bg-white/90 transition-colors"
                  >
                    К мастер-классу
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Нижняя панель управления */}
      {src && (
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2 pt-12 sm:px-5 sm:pb-3 transition-opacity duration-300 ${
            showControls && !ended
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        >
          <SeekBar
            currentTime={currentTime}
            duration={duration}
            bufferedEnd={bufferedEnd}
            onScrub={(t) => setCurrentTime(t)}
            onScrubStart={() => setScrubbing(true)}
            onScrubEnd={(t) => {
              setScrubbing(false);
              seekTo(t);
            }}
          />

          <div className="mt-1 flex items-center gap-0.5 sm:gap-1">
            <CtrlButton
              label={playing ? "Пауза (K)" : "Смотреть (K)"}
              onClick={togglePlay}
            >
              {playing ? (
                <Pause className="size-5 fill-current" />
              ) : (
                <Play className="size-5 fill-current" />
              )}
            </CtrlButton>
            <CtrlButton
              label="Назад на 10 секунд (J)"
              onClick={() => seekBy(-SEEK_STEP)}
            >
              <SeekIcon direction="back" />
            </CtrlButton>
            <CtrlButton
              label="Вперёд на 10 секунд (L)"
              onClick={() => seekBy(SEEK_STEP)}
            >
              <SeekIcon direction="forward" />
            </CtrlButton>
            {nextLesson && (
              <CtrlButton
                label="Следующий урок (Shift+N)"
                onClick={goNext}
                className="hidden sm:flex"
              >
                <SkipForward className="size-5 fill-current" />
              </CtrlButton>
            )}

            {/* Громкость */}
            <div className="group/volume flex items-center">
              <CtrlButton
                label={
                  effectiveVolume === 0 ? "Включить звук (M)" : "Без звука (M)"
                }
                onClick={toggleMute}
              >
                <VolumeIcon className="size-5" />
              </CtrlButton>
              <div className="hidden w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover/volume:w-20 group-hover/volume:opacity-100 group-focus-within/volume:w-20 group-focus-within/volume:opacity-100 sm:block">
                <VolumeSlider value={effectiveVolume} onChange={setVolume} />
              </div>
            </div>

            <span className="ml-1.5 whitespace-nowrap text-xs tabular-nums text-white/85 sm:ml-2 sm:text-[13px]">
              {formatTime(currentTime)}
              <span className="text-white/45"> / {formatTime(duration)}</span>
            </span>

            <div className="flex-1" />

            {prefs.rate !== 1 && (
              <span className="mr-1 hidden rounded bg-white/15 px-1.5 py-0.5 text-[11px] font-medium tabular-nums sm:inline">
                {formatRate(prefs.rate)}
              </span>
            )}

            <div className="relative">
              <CtrlButton
                label="Настройки"
                active={settingsView !== null}
                onClick={() => {
                  setHelpOpen(false);
                  setSettingsView((v) => (v ? null : "main"));
                }}
              >
                <Settings
                  className={`size-5 transition-transform duration-300 ${
                    settingsView ? "rotate-45" : ""
                  }`}
                />
              </CtrlButton>
              <AnimatePresence>
                {settingsView && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full right-0 mb-3 w-64 origin-bottom-right overflow-hidden rounded-xl bg-black/85 py-1.5 text-sm shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
                  >
                    {settingsView === "main" ? (
                      <>
                        <MenuRow
                          icon={<Gauge className="size-4" />}
                          label="Скорость"
                          value={formatRate(prefs.rate)}
                          onClick={() => setSettingsView("speed")}
                          chevron
                        />
                        {nextLesson && (
                          <MenuRow
                            icon={<SkipForward className="size-4" />}
                            label="Автопереход к следующему"
                            onClick={() =>
                              updatePrefs({ autoNext: !prefs.autoNext })
                            }
                            toggle={prefs.autoNext}
                          />
                        )}
                        <MenuRow
                          icon={<Keyboard className="size-4" />}
                          label="Горячие клавиши"
                          value="?"
                          onClick={() => {
                            setSettingsView(null);
                            setHelpOpen(true);
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setSettingsView("main")}
                          className="flex w-full items-center gap-2 border-b border-white/10 px-3 pb-2 pt-1 text-left font-medium hover:text-white/80"
                        >
                          <ChevronLeft className="size-4" />
                          Скорость воспроизведения
                        </button>
                        <div className="py-1">
                          {SPEEDS.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setRate(s);
                                setSettingsView(null);
                              }}
                              className="flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-white/10"
                            >
                              <span className="flex w-4 justify-center">
                                {prefs.rate === s && (
                                  <Check className="size-4" />
                                )}
                              </span>
                              {formatRate(s)}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {pipSupported && (
              <CtrlButton
                label={
                  pip
                    ? "Выйти из режима «картинка в картинке» (I)"
                    : "Картинка в картинке (I)"
                }
                active={pip}
                onClick={() => void togglePip()}
                className="hidden sm:flex"
              >
                <PictureInPicture2 className="size-5" />
              </CtrlButton>
            )}
            <CtrlButton
              label={
                fullscreen
                  ? "Выйти из полноэкранного режима (F)"
                  : "Во весь экран (F)"
              }
              onClick={toggleFullscreen}
            >
              {fullscreen ? (
                <Minimize className="size-5" />
              ) : (
                <Maximize className="size-5" />
              )}
            </CtrlButton>
          </div>
        </div>
      )}

      {/* Справка по горячим клавишам */}
      <AnimatePresence>
        {helpOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <div className="relative w-full max-w-md rounded-2xl bg-black/60 p-5 ring-1 ring-white/10">
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => setHelpOpen(false)}
                className="absolute right-3 top-3 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </button>
              <p className="mb-3 font-serif text-lg">Горячие клавиши</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs sm:text-sm">
                {SHORTCUTS.map(([keys, desc]) => (
                  <div key={desc} className="contents">
                    <dt className="flex flex-wrap gap-1">
                      {keys.map((k) => (
                        <kbd
                          key={k}
                          className="min-w-6 rounded bg-white/10 px-1.5 py-0.5 text-center font-sans text-[11px] text-white/90"
                        >
                          {k}
                        </kbd>
                      ))}
                    </dt>
                    <dd className="self-center text-white/70">{desc}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

const SHORTCUTS: [string[], string][] = [
  [["Пробел", "K"], "Пауза / продолжить"],
  [["←", "→"], "Перемотка на 5 секунд"],
  [["J", "L"], "Перемотка на 10 секунд"],
  [["↑", "↓"], "Громкость"],
  [["M"], "Выключить / включить звук"],
  [["<", ">"], "Скорость воспроизведения"],
  [["0–9"], "Перейти к 0–90% урока"],
  [["F"], "Во весь экран"],
  [["I"], "Картинка в картинке"],
  [["Shift", "N"], "Следующий урок"],
  [["?"], "Эта подсказка"],
];

// ── Мелкие компоненты ─────────────────────────────────────────────

function CtrlButton({
  label,
  onClick,
  children,
  active,
  className = "",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Не забираем фокус мышью, чтобы пробел не «нажимал» кнопку повторно
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex size-9 shrink-0 items-center justify-center rounded-full outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70 sm:size-10 ${
        active ? "bg-white/15" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}

function SeekIcon({ direction }: { direction: "back" | "forward" }) {
  return (
    <span className="relative flex size-6 items-center justify-center">
      <RotateCcw
        className={`absolute size-6 ${direction === "forward" ? "-scale-x-100" : ""}`}
        strokeWidth={1.75}
      />
      <span className="relative mt-px text-[8px] font-semibold">10</span>
    </span>
  );
}

function MenuRow({
  icon,
  label,
  value,
  onClick,
  chevron,
  toggle,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  onClick: () => void;
  chevron?: boolean;
  toggle?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={toggle}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/10"
    >
      <span className="text-white/70">{icon}</span>
      <span className="flex-1">{label}</span>
      {value && <span className="text-white/60">{value}</span>}
      {chevron && <ChevronRight className="size-4 text-white/60" />}
      {toggle !== undefined && (
        <span
          className={`relative h-4 w-7 rounded-full transition-colors ${
            toggle ? "bg-white" : "bg-white/25"
          }`}
        >
          <span
            className={`absolute top-0.5 size-3 rounded-full transition-all ${
              toggle ? "left-3.5 bg-black" : "left-0.5 bg-white"
            }`}
          />
        </span>
      )}
    </button>
  );
}

/** Возвращает долю [0..1] позиции указателя по горизонтали элемента. */
function ratioFromPointer(el: HTMLElement, clientX: number): number {
  const rect = el.getBoundingClientRect();
  return clamp((clientX - rect.left) / rect.width, 0, 1);
}

function SeekBar({
  currentTime,
  duration,
  bufferedEnd,
  onScrub,
  onScrubStart,
  onScrubEnd,
}: {
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  onScrub: (t: number) => void;
  onScrubStart: () => void;
  onScrubEnd: (t: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const pct = duration ? (currentTime / duration) * 100 : 0;
  const bufPct = duration ? (bufferedEnd / duration) * 100 : 0;

  const timeAt = (clientX: number) =>
    trackRef.current
      ? ratioFromPointer(trackRef.current, clientX) * duration
      : 0;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={-1}
      aria-label="Перемотка"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      aria-valuetext={`${formatTime(currentTime)} из ${formatTime(duration)}`}
      onPointerDown={(e) => {
        if (!duration) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        onScrubStart();
        onScrub(timeAt(e.clientX));
      }}
      onPointerMove={(e) => {
        if (!duration) return;
        const t = timeAt(e.clientX);
        if (e.pointerType === "mouse" || dragging) setHover(t);
        if (dragging) onScrub(t);
      }}
      onPointerUp={(e) => {
        if (!dragging) return;
        setDragging(false);
        onScrubEnd(timeAt(e.clientX));
        if (e.pointerType !== "mouse") setHover(null);
      }}
      onPointerCancel={() => {
        setDragging(false);
        setHover(null);
        onScrubEnd(currentTime);
      }}
      onPointerLeave={() => {
        if (!dragging) setHover(null);
      }}
      className="group/seek relative flex h-5 cursor-pointer touch-none items-center"
    >
      <div
        className={`relative w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-150 ${
          dragging ? "h-1.5" : "h-1 group-hover/seek:h-1.5"
        }`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-white/35"
          style={{ width: `${bufPct}%` }}
        />
        {hover !== null && !dragging && (
          <div
            className="absolute inset-y-0 left-0 bg-white/25"
            style={{ width: `${(hover / duration) * 100}%` }}
          />
        )}
        <div
          className="absolute inset-y-0 left-0 bg-white"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className={`pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-150 ${
          dragging ? "scale-100" : "scale-0 group-hover/seek:scale-100"
        }`}
        style={{ left: `${pct}%` }}
      />
      {hover !== null && (
        <div
          className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-md bg-black/85 px-2 py-1 text-xs font-medium tabular-nums ring-1 ring-white/10"
          style={{
            left: `clamp(24px, ${(hover / duration) * 100}%, calc(100% - 24px))`,
          }}
        >
          {formatTime(hover)}
        </div>
      )}
    </div>
  );
}

function VolumeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Громкость"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        draggingRef.current = true;
        onChange(ratioFromPointer(e.currentTarget, e.clientX));
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) {
          onChange(ratioFromPointer(e.currentTarget, e.clientX));
        }
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      className="relative ml-1 mr-2 flex h-9 w-[4.25rem] cursor-pointer touch-none items-center outline-none"
    >
      <div className="relative h-1 w-full rounded-full bg-white/25">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white"
          style={{ width: `${value * 100}%` }}
        />
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          style={{ left: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}
