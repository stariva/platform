"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogTitle,
  toast,
} from "@stariva/ui";
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronLeft,
  IconChevronRight,
  IconPhotoPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import { client } from "~/orpc/react";

/** Фото товара: загрузка в публичный бакет, порядок (первое — обложка), удаление. */
export function ProductImages({
  productId,
  images,
  getImages,
  onChange,
  error,
}: {
  productId?: string;
  images: string[];
  /** Текущее значение формы: пока идёт загрузка, фото могли удалить или переставить. */
  getImages: () => string[];
  onChange: (images: string[]) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  /** Индекс фото, открытого на весь экран. */
  const [viewing, setViewing] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    const next = [...images];
    const [item] = next.splice(from, 1);
    if (item === undefined) return;
    next.splice(to, 0, item);
    onChange(next);
  };

  const upload = async (files: FileList) => {
    const list = [...files];
    setUploading(list.length);
    const uploaded: string[] = [];
    for (const file of list) {
      try {
        const { url } = await client.admin.products.uploadImage({
          productId,
          file,
        });
        uploaded.push(url);
      } catch (err) {
        toast.error(`${file.name}: ${(err as Error).message}`);
      } finally {
        setUploading((count) => count - 1);
      }
    }
    // Одинаковые файлы получают один и тот же адрес — не дублируем
    if (uploaded.length > 0) {
      onChange([...new Set([...getImages(), ...uploaded])]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Фото</CardTitle>
        <CardDescription>
          Первое — обложка в каталоге. Изменения сохраняются кнопкой
          «Сохранить».
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {images.length === 0 && (
          <p className="text-muted-foreground text-sm">Фото пока нет</p>
        )}
        <ul className="space-y-2">
          {images.map((url, index) => (
            <li key={url} className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Открыть фото"
                className="shrink-0 cursor-zoom-in rounded"
                onClick={() => setViewing(index)}
              >
                {/* biome-ignore lint/performance/noImgElement: превью из внешнего бакета без оптимизации */}
                <img
                  src={url}
                  alt=""
                  className="size-16 rounded object-cover"
                  loading="lazy"
                />
              </button>
              <span className="text-muted-foreground flex-1 text-xs">
                {index === 0 ? "Обложка" : `Фото ${index + 1}`}
              </span>
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
                disabled={index === images.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <IconArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Убрать фото"
                onClick={() => onChange(images.filter((_, i) => i !== index))}
              >
                <IconTrash />
              </Button>
            </li>
          ))}
        </ul>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) void upload(event.target.files);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={uploading > 0}
          onClick={() => inputRef.current?.click()}
        >
          <IconPhotoPlus />
          {uploading > 0 ? `Загружаем… осталось ${uploading}` : "Добавить фото"}
        </Button>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </CardContent>
      <PhotoViewer images={images} index={viewing} onIndexChange={setViewing} />
    </Card>
  );
}

/** Фото на весь экран; листается стрелками на экране и клавиатуре. */
function PhotoViewer({
  images,
  index,
  onIndexChange,
}: {
  images: string[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const url = index === null ? undefined : images[index];
  const step = (delta: number) => {
    if (index === null || images.length < 2) return;
    onIndexChange((index + delta + images.length) % images.length);
  };

  return (
    <Dialog
      open={url !== undefined}
      onOpenChange={(open) => {
        if (!open) onIndexChange(null);
      }}
    >
      <DialogContent
        className="w-auto max-w-[calc(100vw-2rem)] gap-2 p-2 sm:max-w-[calc(100vw-4rem)]"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") step(-1);
          if (event.key === "ArrowRight") step(1);
        }}
      >
        <DialogTitle className="text-muted-foreground px-1 pr-8 text-sm font-normal">
          Фото {(index ?? 0) + 1} из {images.length}
          {index === 0 && " · обложка"}
        </DialogTitle>
        <div className="relative">
          {/* biome-ignore lint/performance/noImgElement: фото из внешнего бакета без оптимизации */}
          <img
            src={url}
            alt=""
            className="mx-auto max-h-[calc(100vh-7rem)] max-w-full rounded object-contain"
          />
          {images.length > 1 && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Предыдущее фото"
                className="absolute top-1/2 left-2 -translate-y-1/2 opacity-80 hover:opacity-100"
                onClick={() => step(-1)}
              >
                <IconChevronLeft />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Следующее фото"
                className="absolute top-1/2 right-2 -translate-y-1/2 opacity-80 hover:opacity-100"
                onClick={() => step(1)}
              >
                <IconChevronRight />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
