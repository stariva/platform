"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Progress,
  Switch,
  toast,
} from "@stariva/ui";
import {
  formatClock,
  parseClock,
  WORKSHOP_VIDEO_MAX_BYTES,
  WORKSHOP_VIDEO_TYPES,
  type WorkshopLessonValues,
} from "@stariva/validators";
import {
  IconArrowDown,
  IconArrowUp,
  IconPlus,
  IconTrash,
  IconVideo,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { client } from "~/orpc/react";
import { formatBytes, putFile, readVideoDuration } from "./upload";

const newLessonId = () => `l-${crypto.randomUUID().slice(0, 8)}`;

/** Длительность «мин:сек»: пока набирают, держим текст, в форму — только разобранное. */
function DurationInput({
  seconds,
  onChange,
}: {
  seconds: number;
  onChange: (seconds: number) => void;
}) {
  const [text, setText] = useState(formatClock(seconds));
  const [invalid, setInvalid] = useState(false);

  // Длительность подставилась из загруженного видео
  useEffect(() => {
    setText((current) =>
      parseClock(current) === seconds ? current : formatClock(seconds),
    );
    setInvalid(false);
  }, [seconds]);

  return (
    <Input
      value={text}
      inputMode="numeric"
      placeholder="мин:сек"
      aria-invalid={invalid}
      className="w-24 tabular-nums"
      onChange={(event) => {
        setText(event.target.value);
        const parsed = parseClock(event.target.value);
        setInvalid(parsed === null);
        if (parsed !== null) onChange(parsed);
      }}
    />
  );
}

/** Уроки мастер-класса: порядок, бесплатное превью и загрузка видео в бакет. */
export function WorkshopLessons({
  slug,
  lessons,
  getLessons,
  onChange,
  errors,
  rootError,
}: {
  slug: string;
  lessons: WorkshopLessonValues[];
  /** Текущее значение формы: пока идёт загрузка, уроки могли переставить или удалить. */
  getLessons: () => WorkshopLessonValues[];
  onChange: (lessons: WorkshopLessonValues[]) => void;
  errors?: { title?: string; videoKey?: string }[];
  rootError?: string;
}) {
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  // lessonId → доля загруженного (0–1)
  const [progress, setProgress] = useState<Record<string, number>>({});
  const uploading = Object.keys(progress).length > 0;

  // Закрытая вкладка посреди загрузки оборвёт её — предупреждаем
  useEffect(() => {
    if (!uploading) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  const patch = (id: string, changes: Partial<WorkshopLessonValues>) =>
    onChange(
      getLessons().map((lesson) =>
        lesson.id === id ? { ...lesson, ...changes } : lesson,
      ),
    );

  const move = (from: number, to: number) => {
    const next = [...lessons];
    const [item] = next.splice(from, 1);
    if (item === undefined) return;
    next.splice(to, 0, item);
    onChange(next);
  };

  const uploadVideo = async (lesson: WorkshopLessonValues, file: File) => {
    if (!slug) {
      toast.error("Сначала укажите адрес мастер-класса");
      return;
    }
    const contentType = WORKSHOP_VIDEO_TYPES.find((type) => type === file.type);
    if (!contentType) {
      toast.error(`${file.name}: нужен MP4, MOV или WebM`);
      return;
    }
    if (file.size > WORKSHOP_VIDEO_MAX_BYTES) {
      toast.error(`${file.name}: больше 4 ГБ`);
      return;
    }

    setProgress((current) => ({ ...current, [lesson.id]: 0 }));
    try {
      const [{ key, uploadUrl }, duration] = await Promise.all([
        client.admin.workshops.presignUpload({
          kind: "video",
          slug,
          lessonId: lesson.id,
          contentType,
          size: file.size,
        }),
        readVideoDuration(file),
      ]);
      await putFile(uploadUrl, file, contentType, (fraction) =>
        setProgress((current) => ({ ...current, [lesson.id]: fraction })),
      );
      patch(lesson.id, {
        videoKey: key,
        ...(duration !== null && { durationSeconds: duration }),
      });
      toast.success(
        "Видео загружено. Нажмите «Сохранить», чтобы оно появилось в курсе",
      );
    } catch (err) {
      toast.error(`${file.name}: ${(err as Error).message}`);
    } finally {
      setProgress(({ [lesson.id]: _done, ...rest }) => rest);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Уроки</CardTitle>
        <CardDescription>
          Видео уходит прямо в закрытое хранилище и показывается только
          купившим. Бесплатный урок виден всем — это превью курса.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {lessons.length === 0 && (
          <p className="text-muted-foreground text-sm">Уроков пока нет</p>
        )}
        {lessons.map((lesson, index) => {
          const fraction = progress[lesson.id];
          const isUploading = fraction !== undefined;
          const error = errors?.[index];
          return (
            <div key={lesson.id} className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground w-6 text-sm tabular-nums">
                  {index + 1}.
                </span>
                <Input
                  value={lesson.title}
                  placeholder="Название урока"
                  aria-invalid={Boolean(error?.title)}
                  className="min-w-48 flex-1"
                  onChange={(event) =>
                    patch(lesson.id, { title: event.target.value })
                  }
                />
                <DurationInput
                  seconds={lesson.durationSeconds}
                  onChange={(durationSeconds) =>
                    patch(lesson.id, { durationSeconds })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Выше"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <IconArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Ниже"
                  disabled={index === lessons.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <IconArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Удалить урок"
                  disabled={isUploading}
                  onClick={() => {
                    if (
                      lesson.videoKey &&
                      !window.confirm(
                        `Убрать урок «${lesson.title || index + 1}»? Видео останется в хранилище, но из курса исчезнет.`,
                      )
                    ) {
                      return;
                    }
                    onChange(lessons.filter((item) => item.id !== lesson.id));
                  }}
                >
                  <IconTrash />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 pl-8">
                <input
                  ref={(element) => {
                    inputs.current[lesson.id] = element;
                  }}
                  type="file"
                  accept={WORKSHOP_VIDEO_TYPES.join(",")}
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadVideo(lesson, file);
                    event.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => inputs.current[lesson.id]?.click()}
                >
                  <IconVideo />
                  {lesson.videoKey ? "Заменить видео" : "Загрузить видео"}
                </Button>
                <span className="text-muted-foreground text-xs">
                  {isUploading
                    ? `Загружаем… ${Math.round(fraction * 100)}%`
                    : lesson.videoKey
                      ? `Видео есть · ${lesson.videoKey.split("/").pop()}`
                      : "Видео не загружено"}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Label
                    htmlFor={`free-${lesson.id}`}
                    className="text-sm font-normal"
                  >
                    Бесплатное превью
                  </Label>
                  <Switch
                    id={`free-${lesson.id}`}
                    checked={lesson.free}
                    onCheckedChange={(free) => patch(lesson.id, { free })}
                  />
                </div>
              </div>

              {isUploading && (
                <Progress value={Math.round(fraction * 100)} className="pl-8" />
              )}
              {(error?.title || error?.videoKey) && (
                <p className="text-destructive pl-8 text-xs">
                  {error.title ?? error.videoKey}
                </p>
              )}
            </div>
          );
        })}
        {rootError && <p className="text-destructive text-xs">{rootError}</p>}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() =>
            onChange([
              ...getLessons(),
              {
                id: newLessonId(),
                title: "",
                durationSeconds: 0,
                videoKey: "",
                free: getLessons().length === 0,
              },
            ])
          }
        >
          <IconPlus />
          Добавить урок
        </Button>
        <p className="text-muted-foreground text-xs">
          Форматы MP4, MOV, WebM, до {formatBytes(WORKSHOP_VIDEO_MAX_BYTES)} на
          урок. Длительность подставляется из файла.
        </p>
      </CardContent>
    </Card>
  );
}
