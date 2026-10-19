"use client";

import "@videojs/react/video/skin.css";
import "@videojs/react/i18n/locales/ru/register";
import { orientationLockFeature, videoFeatures } from "@videojs/core/dom";
import { createPlayer } from "@videojs/react";
import { I18nProvider } from "@videojs/react/i18n";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { Video, VideoSkin } from "@videojs/react/video";
import { Check, RefreshCw, RotateCcw, SkipForward } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { z } from "zod";
import { accessErrorMessage, webApi } from "@/lib/web-api";

interface VideoPlayerProps {
  slug: string;
  lessonId: string;
  /** Сохранённая позиция (секунды) для продолжения с места. */
  initialPosition: number;
  /** Был ли урок уже отмечен как пройденный. */
  initialCompleted?: boolean;
  lessonTitle: string;
  nextLesson: { id: string; title: string } | null;
  /** Ссылка на страницу мастер-класса. */
  courseHref: string;
  /** Email покупателя: виден поверх видео, чтобы по записи экрана было видно, чья копия. */
  watermark: string;
}

/** Что отдал account.lessonVideo: HLS через сайт или, пока видео не нарезано, MP4. */
interface LessonSource {
  url: string;
  type: "hls" | "mp4";
  /** Когда истекает ссылка или пропуск, мс. */
  expiresAt: number;
}

/** С какого места продолжить после загрузки (или смены) источника. */
interface ResumeState {
  position: number;
  play: boolean;
  /** Первая загрузка урока: показать «Продолжаем с …». */
  initial: boolean;
}

const AUTONEXT_SECONDS = 8;
const MAX_SOURCE_RETRIES = 2;
// Ошибка незадолго до конца срока ссылки — тоже считаем истёкшей
const LINK_EXPIRY_MARGIN_MS = 30_000;
// Как часто водяной знак переезжает в другое место кадра. Редко и с плавным
// угасанием: знак еле заметен и не должен отвлекать от урока
const WATERMARK_MOVE_MS = 60_000;

const PREFS_KEY = "stariva-player-prefs";
// Флаг «запустить сразу» при автопереходе к следующему уроку
const AUTOPLAY_KEY = "stariva-player-autoplay";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// Буфер hls.js. Вперёд держим минуту: урок одного качества (~6 Мбит/с), и
// запас переживает провалы мобильной сети. Позади — полминуты: по умолчанию
// hls.js копит всё просмотренное, на телефоне память MSE кончается, и он
// выбрасывает уже скачанные куски и урезает буфер — видео то и дело встаёт.
// maxMaxBufferLength не даёт hls.js растянуть буфер сверх этого по maxBufferSize
const HLS_BUFFER = {
  maxBufferLength: 60,
  maxMaxBufferLength: 60,
  backBufferLength: 30,
};

interface PlayerPrefs {
  volume: number;
  muted: boolean;
  rate: number;
}

// Старые настройки (с autoNext) тоже подходят: лишние поля zod отбросит
const playerPrefsSchema = z.object({
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  rate: z.number().refine((rate) => SPEEDS.includes(rate)),
});

function readPrefs(): PlayerPrefs | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const result = playerPrefsSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
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

// Стандартный набор плеера не поворачивает экран: на Android полноэкранное
// видео так и оставалось вертикальным. orientationLock держит альбомную
// ориентацию, пока плеер на весь экран
const { Player, usePlayer } = createPlayer({
  features: [...videoFeatures, orientationLockFeature],
  displayName: "LessonPlayer",
});

// Скин Video.js в цветах сайта
const skinStyle = {
  "--media-accent-color": "var(--color-terracotta)",
  "--media-accent-text-color": "white",
  "--media-border-radius": "1rem",
  "--media-border-color": "transparent",
  "--media-font-family": "var(--font-sans)",
} as CSSProperties;

export function VideoPlayer({
  slug,
  lessonId,
  initialPosition,
  initialCompleted = false,
  lessonTitle,
  nextLesson,
  courseHref,
  watermark,
}: VideoPlayerProps) {
  const [source, setSource] = useState<LessonSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const resumeRef = useRef<ResumeState>({
    position: initialPosition,
    play: false,
    initial: true,
  });
  // Текущая позиция: её пишет LessonController, читает «Попробовать снова»
  const positionRef = useRef(initialPosition);

  // ── Ссылка на видео ─────────────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken намеренно перезапрашивает ссылку
  useEffect(() => {
    let active = true;
    webApi.account
      .lessonVideo({ slug, lessonId })
      .then((d) => {
        if (!active) return;
        setSource({
          url: d.url,
          type: d.type,
          expiresAt: Date.now() + d.expiresIn * 1000,
        });
      })
      .catch((e: unknown) => {
        if (active)
          setError(accessErrorMessage(e, "Не удалось загрузить видео"));
      });
    return () => {
      active = false;
    };
  }, [slug, lessonId, reloadToken]);

  /** Новая ссылка, продолжая с того же места. */
  const refreshSource = useCallback((position: number, play: boolean) => {
    resumeRef.current = { position, play, initial: false };
    setReloadToken((t) => t + 1);
  }, []);

  const media = useMemo(() => {
    if (!source) return null;
    const common = {
      playsInline: true,
      preload: "metadata" as const,
      controlsList: "nodownload",
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    };
    // Новая ссылка — новый элемент: адаптер hls.js помнит ошибку прошлой
    // загрузки, и диалог ошибки плеера не закрылся бы
    if (source.type === "hls") {
      const { position } = resumeRef.current;
      return (
        <HlsJsVideo
          key={source.url}
          {...common}
          // Куски грузятся сразу, ещё до «Play», — старт без ожидания.
          // С metadata hls.js до запуска держал буфер в одну секунду
          preload="auto"
          source={{
            src: source.url,
            type: "application/vnd.apple.mpegurl",
            engine: {
              hlsJs: {
                ...HLS_BUFFER,
                // Грузим сразу с места, где остановились, а не с начала урока
                startPosition: position > 0 ? position : -1,
              },
            },
          }}
        />
      );
    }
    return (
      <Video key={source.url} {...common} src={source.url} />
    );
  }, [source]);

  if (error) {
    return (
      <div className="aspect-video rounded-2xl bg-espresso flex flex-col items-center justify-center text-parchment gap-3 px-6 text-center">
        <p className="font-serif text-xl">Видео недоступно</p>
        <p className="text-parchment/60 text-sm max-w-sm">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setSource(null);
            refreshSource(positionRef.current, false);
          }}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-parchment text-espresso px-5 py-2 text-sm font-medium hover:bg-parchment/90 transition-colors"
        >
          <RefreshCw className="size-4" />
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <I18nProvider locale="ru">
      <Player title={lessonTitle}>
        {/* Пропорции держит обёртка: скин заполняет её целиком и не может
            стать выше кадра и наехать на заголовок урока */}
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
          <VideoSkin
            className="absolute inset-0 size-full overflow-hidden rounded-2xl bg-black"
            style={skinStyle}
          >
            {media}
            {source && <Watermark text={watermark} />}
            <LessonController
              slug={slug}
              lessonId={lessonId}
              initialCompleted={initialCompleted}
              nextLesson={nextLesson}
              courseHref={courseHref}
              source={source}
              resumeRef={resumeRef}
              positionRef={positionRef}
              onRefresh={refreshSource}
              onFatalError={setError}
            />
          </VideoSkin>
        </div>
      </Player>
    </I18nProvider>
  );
}

/**
 * Всё, что плеер Video.js не знает про уроки: продолжение с места,
 * сохранение прогресса и настроек, новая ссылка взамен истёкшей, экран
 * окончания урока с переходом к следующему.
 */
function LessonController({
  slug,
  lessonId,
  initialCompleted,
  nextLesson,
  courseHref,
  source,
  resumeRef,
  positionRef,
  onRefresh,
  onFatalError,
}: {
  slug: string;
  lessonId: string;
  initialCompleted: boolean;
  nextLesson: VideoPlayerProps["nextLesson"];
  courseHref: string;
  source: LessonSource | null;
  resumeRef: RefObject<ResumeState>;
  positionRef: RefObject<number>;
  onRefresh: (position: number, play: boolean) => void;
  onFatalError: (message: string) => void;
}) {
  const router = useRouter();
  const store = usePlayer();
  const { paused, ended, started, currentTime, duration, error } = usePlayer(
    (s) => ({
      paused: s.paused,
      ended: s.ended,
      started: s.started,
      currentTime: s.currentTime,
      duration: s.duration,
      error: s.error,
    }),
  );
  const { volume, muted, playbackRate } = usePlayer((s) => ({
    volume: s.volume,
    muted: s.muted,
    playbackRate: s.playbackRate,
  }));

  const [resumeNotice, setResumeNotice] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  // Источник, для которого уже восстановили место и настройки
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const ready = source !== null && readyUrl === source.url;

  const appliedUrlRef = useRef<string | null>(null);
  const [savedPrefs] = useState(readPrefs);
  const prefsRef = useRef<PlayerPrefs | null>(savedPrefs);
  const lastSavedRef = useRef(0);
  const durationRef = useRef(0);
  const completedRef = useRef(initialCompleted);
  const retriesRef = useRef(0);
  const playingRef = useRef(false);

  // ── Сохранение прогресса ────────────────────────────────────────
  const saveProgress = useCallback(
    (positionSeconds: number, durationSeconds: number, completed?: boolean) => {
      webApi.account
        .saveLessonProgress(
          { slug, lessonId, positionSeconds, durationSeconds, completed },
          // keepalive — чтобы запрос успел уйти при закрытии вкладки
          { context: { keepalive: true } },
        )
        .catch(() => {
          /* тихо игнорируем сетевые сбои сохранения прогресса */
        });
    },
    [slug, lessonId],
  );

  const saveNow = useCallback(() => {
    const videoDuration = durationRef.current;
    if (videoDuration && !completedRef.current) {
      lastSavedRef.current = positionRef.current;
      saveProgress(positionRef.current, videoDuration);
    }
  }, [saveProgress, positionRef]);

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

  // ── Источник загрузился: место, скорость, автозапуск ─────────────
  // Готовым источник считаем после перемотки: иначе прогресс успел бы
  // сохранить нулевую позицию поверх сохранённого места
  useEffect(() => {
    if (!source || appliedUrlRef.current === source.url || duration <= 0) {
      return;
    }
    const url = source.url;
    appliedUrlRef.current = url;
    durationRef.current = duration;
    // Ошибка прошлой ссылки могла остаться в плеере — новая уже работает
    store.dismissError();

    // Новый <video> или новый src сбрасывает скорость — возвращаем свою
    const prefs = prefsRef.current;
    if (prefs) {
      store.setVolume(prefs.volume);
      if (prefs.muted) store.setMuted(true);
      store.setPlaybackRate(prefs.rate);
    }

    const { position, play, initial } = resumeRef.current;
    let autoplay = play;
    try {
      if (sessionStorage.getItem(AUTOPLAY_KEY)) {
        sessionStorage.removeItem(AUTOPLAY_KEY);
        autoplay = true;
      }
    } catch {
      /* ignore */
    }
    const start = () => {
      setReadyUrl(url);
      if (autoplay) store.play().catch(() => {});
    };

    if (position > 0 && position < duration - 5) {
      positionRef.current = position;
      lastSavedRef.current = position;
      if (initial && position > 15) setResumeNotice(position);
      store.seek(position).then(start, start);
    } else if (position > 0) {
      // Урок досмотрен до конца — заново с начала. hls.js уже встал на
      // сохранённое место (startPosition), сам он к нулю не вернётся
      store.seek(0).then(start, start);
    } else {
      start();
    }
  }, [source, duration, store, resumeRef, positionRef]);

  // ── Позиция и прогресс ──────────────────────────────────────────
  useEffect(() => {
    if (!ready || !duration) return;
    positionRef.current = currentTime;
    durationRef.current = duration;
    // Видео идёт дальше места, с которого продолжили, — источник рабочий
    if (currentTime > resumeRef.current.position + 10) retriesRef.current = 0;
    // Троттлинг сохранения: не чаще раза в 10 секунд
    if (Math.abs(currentTime - lastSavedRef.current) >= 10) {
      lastSavedRef.current = currentTime;
      saveProgress(currentTime, duration);
    }
  }, [ready, currentTime, duration, saveProgress, positionRef, resumeRef]);

  useEffect(() => {
    if (error) return;
    playingRef.current = !paused;
    if (paused && ready) saveNow();
  }, [paused, error, ready, saveNow]);

  // ── Настройки звука и скорости ──────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const prefs = { volume, muted, rate: playbackRate };
    prefsRef.current = prefs;
    writePrefs(prefs);
  }, [ready, volume, muted, playbackRate]);

  // ── Ошибки: истёкшая ссылка — берём новую, остальное — не больше 2 раз ──
  useEffect(() => {
    if (!error || !source) return;
    const expired = Date.now() > source.expiresAt - LINK_EXPIRY_MARGIN_MS;
    if (expired || retriesRef.current < MAX_SOURCE_RETRIES) {
      if (!expired) retriesRef.current += 1;
      store.dismissError();
      onRefresh(positionRef.current, playingRef.current);
      return;
    }
    onFatalError(
      "Не удалось воспроизвести видео. Проверьте подключение к интернету.",
    );
  }, [error, source, store, onRefresh, onFatalError, positionRef]);

  // ── Конец урока ─────────────────────────────────────────────────
  useEffect(() => {
    if (!ended || !ready) return;
    if (!completedRef.current) {
      completedRef.current = true;
      saveProgress(durationRef.current, durationRef.current, true);
      toast.success("Урок пройден");
      router.refresh();
    }
    if (nextLesson) setCountdown(AUTONEXT_SECONDS);
  }, [ended, ready, nextLesson, saveProgress, router]);

  const goNext = useCallback(() => {
    if (!nextLesson) return;
    try {
      sessionStorage.setItem(AUTOPLAY_KEY, "1");
    } catch {
      /* без автозапуска — не страшно */
    }
    router.push(`/account/workshops/${slug}/${nextLesson.id}`);
  }, [nextLesson, router, slug]);

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

  const replay = () => {
    setCountdown(null);
    void store.seek(0);
    store.play().catch(() => {});
  };

  return (
    <>
      {/* «Продолжаем с …» */}
      <AnimatePresence>
        {resumeNotice !== null && started && !ended && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute z-[35] left-3 bottom-20 sm:left-5 sm:bottom-24 flex items-center gap-3 rounded-full bg-black/75 py-1.5 pl-4 pr-1.5 text-xs sm:text-sm text-white backdrop-blur-md"
          >
            <span className="text-white/80">
              Продолжаем с {formatTime(resumeNotice)}
            </span>
            <button
              type="button"
              onClick={() => {
                void store.seek(0);
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
      {ended && ready && (
        <div className="absolute inset-0 z-[35] flex items-center justify-center bg-black/80 backdrop-blur-sm px-6 text-white">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            {nextLesson ? (
              <>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
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
    </>
  );
}

/**
 * Еле заметный email покупателя поверх видео. Время от времени переезжает в
 * другое место кадра, чтобы его нельзя было закрыть или вырезать на записи экрана.
 * Лежит над картинкой, но под панелью управления плеера.
 */
function Watermark({ text }: { text: string }) {
  // До первого переезда — фиксированное место, чтобы разметка сервера и
  // браузера совпадала
  const [position, setPosition] = useState({ top: 12, left: 6 });
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let fadeTimer: number | undefined;
    const move = () => {
      setVisible(false);
      fadeTimer = window.setTimeout(() => {
        setPosition({
          top: 8 + Math.random() * 72,
          left: 4 + Math.random() * 56,
        });
        setVisible(true);
      }, 1500);
    };
    move();
    const interval = window.setInterval(move, WATERMARK_MOVE_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(fadeTimer);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute z-[15] select-none whitespace-nowrap text-[10px] text-white transition-opacity duration-[1500ms] [text-shadow:0_1px_1px_rgb(0_0_0/0.3)] sm:text-xs ${
        visible ? "opacity-[0.12]" : "opacity-0"
      }`}
      style={{ top: `${position.top}%`, left: `${position.left}%` }}
    >
      {text}
    </div>
  );
}
