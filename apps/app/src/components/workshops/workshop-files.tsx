"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  toast,
} from "@stariva/ui";
import {
  WORKSHOP_MATERIAL_MAX_BYTES,
  WORKSHOP_MATERIAL_TYPES,
  type WorkshopMaterialFileValues,
} from "@stariva/validators";
import { IconFileUpload, IconTrash } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { client } from "~/orpc/react";
import { formatBytes, putFile } from "./upload";

/** PDF к курсу (выкройки, схемы): скачивают только купившие. */
export function WorkshopFiles({
  slug,
  files,
  getFiles,
  onChange,
}: {
  slug: string;
  files: WorkshopMaterialFileValues[];
  /** Текущее значение формы: пока идёт загрузка, список могли поменять. */
  getFiles: () => WorkshopMaterialFileValues[];
  onChange: (files: WorkshopMaterialFileValues[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (!slug) {
      toast.error("Сначала укажите адрес мастер-класса");
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error(`${file.name}: нужен PDF`);
      return;
    }
    if (file.size > WORKSHOP_MATERIAL_MAX_BYTES) {
      toast.error(
        `${file.name}: больше ${formatBytes(WORKSHOP_MATERIAL_MAX_BYTES)}`,
      );
      return;
    }
    setUploading(file.name);
    try {
      const { key, uploadUrl } = await client.admin.workshops.presignUpload({
        kind: "material",
        slug,
        fileName: file.name,
        contentType: "application/pdf",
        size: file.size,
      });
      await putFile(uploadUrl, file, "application/pdf", () => {});
      onChange([
        ...getFiles(),
        { label: file.name.replace(/\.pdf$/i, ""), key },
      ]);
    } catch (err) {
      toast.error(`${file.name}: ${(err as Error).message}`);
    } finally {
      setUploading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Материалы</CardTitle>
        <CardDescription>
          PDF для скачивания в кабинете: выкройки, схемы, списки покупок.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {files.length === 0 && (
          <p className="text-muted-foreground text-sm">Файлов пока нет</p>
        )}
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.key} className="flex items-center gap-2">
              <Input
                value={file.label}
                aria-label="Название файла"
                onChange={(event) =>
                  onChange(
                    getFiles().map((item) =>
                      item.key === file.key
                        ? { ...item, label: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Убрать файл"
                onClick={() =>
                  onChange(files.filter((item) => item.key !== file.key))
                }
              >
                <IconTrash />
              </Button>
            </li>
          ))}
        </ul>
        <input
          ref={inputRef}
          type="file"
          accept={WORKSHOP_MATERIAL_TYPES.join(",")}
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
          className="w-full"
          disabled={uploading !== null}
          onClick={() => inputRef.current?.click()}
        >
          <IconFileUpload />
          {uploading ? `Загружаем ${uploading}…` : "Добавить PDF"}
        </Button>
      </CardContent>
    </Card>
  );
}
