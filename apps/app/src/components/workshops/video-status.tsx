import type { RouterOutputs } from "@stariva/api";
import { Badge, cn } from "@stariva/ui";
import {
  IconAlertTriangle,
  IconCircleCheckFilled,
  IconClock,
  IconLoader2,
} from "@tabler/icons-react";

/** Видео урока: время загрузки и нарезка в HLS. */
export type LessonVideo = RouterOutputs["admin"]["workshops"]["videos"][string];
type HlsVariant = NonNullable<LessonVideo["hls"]["ready"]>["variants"][number];

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

const tone = {
  ok: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  wait: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

/** Плашки нарезки: готова ли, в каких качествах, что сейчас происходит. */
export function HlsStatus({ video }: { video: LessonVideo }) {
  const { state, attempts, willRetry, error, ready } = video.hls;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {ready ? (
          <>
            <Badge className={tone.ok}>
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
              <Badge variant="outline">одно качество</Badge>
            )}
          </>
        ) : null}

        {state === "queued" && (
          <Badge variant="secondary">
            <IconClock />
            {ready ? "Ждёт перерезки" : "В очереди на нарезку"}
          </Badge>
        )}
        {state === "processing" && (
          <Badge className={tone.wait}>
            <IconLoader2 className="animate-spin" />
            {ready ? "Перерезаем в новые качества" : "Нарезаем в HLS"}
            {attempts > 1 && ` · попытка ${attempts}`}
          </Badge>
        )}
        {state === "failed" && (
          <Badge
            variant={willRetry ? undefined : "destructive"}
            className={cn(willRetry && tone.wait)}
          >
            <IconAlertTriangle />
            {willRetry
              ? `Не нарезалось, повторим · попытка ${attempts}`
              : ready
                ? "Перерезать не вышло"
                : "Не нарезалось"}
          </Badge>
        )}
      </div>
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
  const pending = known.filter(isHlsPending).length;
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
            className={cn(ready === withVideo.length ? tone.ok : tone.wait)}
          >
            {ready === withVideo.length && <IconCircleCheckFilled />}
            готов {ready} из {withVideo.length}
          </Badge>
          {pending > 0 && (
            <Badge variant="secondary">
              <IconLoader2 className="animate-spin" />в работе {pending}
            </Badge>
          )}
          {failed > 0 && (
            <Badge variant="destructive">
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
