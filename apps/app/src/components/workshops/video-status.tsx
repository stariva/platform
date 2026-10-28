import type { RouterOutputs } from "@stariva/api";
import { Badge } from "@stariva/ui/reui";
import {
  IconAlertTriangle,
  IconCircleCheckFilled,
  IconClock,
  IconLoader2,
} from "@tabler/icons-react";

/** Видео урока: время загрузки и нарезка в HLS. */
export type LessonVideo = RouterOutputs["admin"]["workshops"]["videos"][string];
type HlsVariant = NonNullable<LessonVideo["hls"]["ready"]>["variants"][number];
type HlsProgress = NonNullable<LessonVideo["hls"]["progress"]>;

export const videoDateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

/** Нарезка ещё может поменяться: стоит спросить сервер снова. */
export function isHlsPending(video: LessonVideo): boolean {
  const { state, willRetry } = video.hls;
  return (
    state === "queued" ||
    state === "processing" ||
    (state === "failed" && willRetry)
  );
}

/** «1080p» по короткой стороне кадра: вертикальное видео тоже 1080p. */
function variantLabel(variant: HlsVariant): string {
  if (!variant.width || !variant.height) return "исходник";
  return `${Math.min(variant.width, variant.height)}p`;
}

const mbps = (bits: number) =>
  `${(bits / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} Мбит/с`;

/**
 * Ход нарезки по качествам: «1080p готово · 720p 47% · 480p ждёт». Пока
 * верхнее качество не залито, его размер неизвестен — «исходное».
 */
function HlsProgressBadges({ progress }: { progress: HlsProgress }) {
  const { variants, totalSegments } = progress;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {variants.map((variant, index) => {
        const label = variant.size
          ? `${variant.size}p`
          : index === 0
            ? "исходное"
            : `качество ${index + 1}`;
        if (variant.state === "done") {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: качества идут по номеру папки v0, v1…
            <Badge key={index} variant="success-light">
              <IconCircleCheckFilled />
              {label}
            </Badge>
          );
        }
        if (variant.state === "waiting") {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: качества идут по номеру папки v0, v1…
            <Badge key={index} variant="secondary">
              <IconClock />
              {label} · ждёт
            </Badge>
          );
        }
        // Куски считаем по готовому качеству и бывает на один больше — до
        // плейлиста не показываем 100%
        const percent = totalSegments
          ? Math.min(99, Math.floor((variant.segments / totalSegments) * 100))
          : null;
        const minutes = Math.floor((variant.segments * 6) / 60);
        return (
          <Badge
            // biome-ignore lint/suspicious/noArrayIndexKey: качества идут по номеру папки v0, v1…
            key={index}
            variant="warning-light"
            className="tabular-nums"
            title={`Залито кусков: ${variant.segments}${totalSegments ? ` из ~${totalSegments}` : ""}`}
          >
            <IconLoader2 className="animate-spin" />
            {label} · {percent !== null ? `${percent}%` : `${minutes} мин`}
          </Badge>
        );
      })}
    </div>
  );
}

/** Плашки нарезки: готова ли, в каких качествах, что сейчас происходит. */
export function HlsStatus({ video }: { video: LessonVideo }) {
  const { state, attempts, willRetry, error, ready, stalled, progress } =
    video.hls;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {ready ? (
          <>
            <Badge variant="success-light">
              <IconCircleCheckFilled />
              HLS готов
            </Badge>
            {ready.variants.length > 0 ? (
              ready.variants.map((variant) => (
                <Badge
                  key={`${variant.width}x${variant.height}-${variant.bandwidth}`}
                  variant="outline"
                  className="tabular-nums"
                  title={
                    variant.width && variant.height
                      ? `${variant.width}×${variant.height}, до ${mbps(variant.bandwidth)}`
                      : `До ${mbps(variant.bandwidth)}`
                  }
                >
                  {variantLabel(variant)}
                </Badge>
              ))
            ) : (
              <Badge variant="outline">
                {ready.version < 2 ? "одно качество" : "качества недоступны"}
              </Badge>
            )}
          </>
        ) : null}

        {state === "queued" && (
          <Badge variant="secondary">
            <IconClock />
            {ready ? "Ждёт перерезки" : "В очереди на нарезку"}
          </Badge>
        )}
        {state === "processing" && !stalled && (
          <Badge variant="warning-light">
            <IconLoader2 className="animate-spin" />
            {ready ? "Перерезаем в новые качества" : "Нарезаем в HLS"}
            {attempts > 1 && ` · попытка ${attempts}`}
          </Badge>
        )}
        {state === "processing" && stalled && (
          <Badge variant="destructive-light">
            <IconAlertTriangle />
            Нарезка зависла · попытка {attempts}
          </Badge>
        )}
        {state === "failed" && (
          <Badge variant={willRetry ? "warning-light" : "destructive-light"}>
            <IconAlertTriangle />
            {willRetry
              ? `Не нарезалось, повторим · попытка ${attempts}`
              : ready
                ? "Перерезать не вышло"
                : "Не нарезалось"}
          </Badge>
        )}
      </div>
      {state === "processing" && progress && progress.variants.length > 0 && (
        <HlsProgressBadges progress={progress} />
      )}
      {state === "processing" && stalled && (
        <p className="text-muted-foreground text-xs">
          Воркер не отвечает
          {video.hls.updatedAt
            ? ` с ${videoDateFormat.format(video.hls.updatedAt)}`
            : ""}
          .{" "}
          {willRetry
            ? "Нарезку подхватит следующий запуск — если его долго нет, проверьте лимит Trigger.dev."
            : "Попытки кончились: загрузите видео заново, чтобы нарезать ещё раз."}
        </p>
      )}
      {!ready && (state === "queued" || state === "processing") && (
        <p className="text-muted-foreground text-xs">
          Пока нарезки нет, ученики смотрят исходный файл — без подстройки
          качества под скорость интернета.
        </p>
      )}
      {state === "failed" && error && (
        <p
          className="text-destructive line-clamp-2 text-xs break-all"
          title={error}
        >
          {error}
        </p>
      )}
      {state === "failed" && !willRetry && !ready && (
        <p className="text-muted-foreground text-xs">
          Ученики смотрят исходный файл. Загрузите видео заново, чтобы нарезать
          ещё раз.
        </p>
      )}
    </div>
  );
}

/** Сводка по видео курса для шапки страницы. */
export function VideoSummary({
  videoKeys,
  videos,
}: {
  /** Ключи видео уроков по порядку; пустой — урок без видео. */
  videoKeys: string[];
  videos: Record<string, LessonVideo>;
}) {
  const withVideo = videoKeys.filter(Boolean);
  const known = withVideo.flatMap((key) => videos[key] ?? []);
  const ready = known.filter((video) => video.hls.ready).length;
  const stalled = known.filter((video) => video.hls.stalled).length;
  const pending = known.filter(isHlsPending).length - stalled;
  const failed = known.filter(
    (video) => video.hls.state === "failed" && !video.hls.willRetry,
  ).length;
  const lastUpload = known.reduce<Date | null>(
    (latest, video) =>
      video.uploadedAt && (!latest || video.uploadedAt > latest)
        ? video.uploadedAt
        : latest,
    null,
  );

  if (videoKeys.length === 0) return null;
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
      <span>
        Видео:{" "}
        <span className="text-foreground tabular-nums">
          {withVideo.length} из {videoKeys.length}
        </span>{" "}
        уроков
      </span>
      {withVideo.length > 0 && (
        <span className="flex items-center gap-1.5">
          HLS:
          <Badge
            variant={
              ready === withVideo.length ? "success-light" : "warning-light"
            }
          >
            {ready === withVideo.length && <IconCircleCheckFilled />}
            готов {ready} из {withVideo.length}
          </Badge>
          {pending > 0 && (
            <Badge variant="secondary">
              <IconLoader2 className="animate-spin" />в работе {pending}
            </Badge>
          )}
          {stalled > 0 && (
            <Badge variant="destructive-light">
              <IconAlertTriangle />
              зависла {stalled}
            </Badge>
          )}
          {failed > 0 && (
            <Badge variant="destructive-light">
              <IconAlertTriangle />
              ошибка {failed}
            </Badge>
          )}
        </span>
      )}
      <span>
        Последняя загрузка:{" "}
        <span className="text-foreground">
          {lastUpload ? videoDateFormat.format(lastUpload) : "—"}
        </span>
      </span>
    </div>
  );
}
