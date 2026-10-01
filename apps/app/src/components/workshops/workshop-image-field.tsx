"use client";

import { Button, Input, Label, toast } from "@stariva/ui";
import { IconPhotoPlus } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { client } from "~/orpc/react";

/** Адрес картинки с превью и загрузкой в публичный бакет. */
export function WorkshopImageField({
  label,
  hint,
  slug,
  value,
  onChange,
  error,
}: {
  label: string;
  hint?: string;
  slug: string;
  value: string;
  onChange: (url: string) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!slug) {
      toast.error("Сначала укажите адрес мастер-класса");
      return;
    }
    setUploading(true);
    try {
      const { url } = await client.admin.workshops.uploadImage({ slug, file });
      onChange(url);
    } catch (err) {
      toast.error(`${file.name}: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        {value ? (
          // biome-ignore lint/performance/noImgElement: превью из внешнего бакета без оптимизации
          <img
            src={value}
            alt=""
            className="h-20 w-32 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="bg-muted h-20 w-32 shrink-0 rounded" />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            value={value}
            placeholder="https://… или /images/…"
            onChange={(event) => onChange(event.target.value)}
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <IconPhotoPlus />
            {uploading ? "Загружаем…" : "Загрузить"}
          </Button>
        </div>
      </div>
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : (
        hint && <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  );
}
