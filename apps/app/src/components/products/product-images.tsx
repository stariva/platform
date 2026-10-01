"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  toast,
} from "@stariva/ui";
import {
  IconArrowDown,
  IconArrowUp,
  IconPhotoPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import { client } from "~/orpc/react";

/** Фото товара: загрузка в публичный бакет, порядок (первое — обложка), удаление. */
export function ProductImages({
  productId,
  images,
  onChange,
  error,
}: {
  productId?: string;
  images: string[];
  onChange: (images: string[]) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

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
      onChange([...new Set([...images, ...uploaded])]);
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
              {/* biome-ignore lint/performance/noImgElement: превью из внешнего бакета без оптимизации */}
              <img
                src={url}
                alt=""
                className="size-16 shrink-0 rounded object-cover"
                loading="lazy"
              />
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
    </Card>
  );
}
