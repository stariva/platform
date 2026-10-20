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
import {
  IconExternalLink,
  IconFileDownload,
  IconFileUpload,
  IconTrash,
} from "@tabler/icons-react";
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
  const [building, setBuilding] = useState<string | null>(null);

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

  const open = async (file: WorkshopMaterialFileValues) => {
    // Вкладку открываем сразу, по клику: после await браузер её заблокирует
    const tab = window.open("", "_blank");
    try {
      const { url } = await client.admin.workshops.materialUrl({
        key: file.key,
      });
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (err) {
      tab?.close();
      toast.error(`${file.label}: ${(err as Error).message}`);
    }
  };

  // Бриф с дописанной страницей «как открыть видео по коду» — для Ярмарки
  const downloadForLivemaster = async (file: WorkshopMaterialFileValues) => {
    setBuilding(file.key);
    try {
      const pdf = await client.admin.workshops.livemasterPdf({ key: file.key });
      // Тип File в ответе — из node; в браузере это обычный Blob
      const url = URL.createObjectURL(
        new Blob([await pdf.arrayBuffer()], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = pdf.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(`${file.label}: ${(err as Error).message}`);
    } finally {
      setBuilding(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Материалы</CardTitle>
        <CardDescription>
          PDF для скачивания в кабинете — кнопка в брифе «Перед началом»: бриф
          для печати, выкройки, схемы.
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
                aria-label="Открыть файл"
                onClick={() => void open(file)}
              >
                <IconExternalLink />
              </Button>
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
        <div id="livemaster-pdf" className="space-y-2 border-t pt-3">
          {(files.length > 0 ? files : [null]).map((file) => (
            <Button
              key={file?.key ?? "empty"}
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!file || building !== null}
              onClick={() => file && void downloadForLivemaster(file)}
            >
              <IconFileDownload />
              {file && building === file.key
                ? "Собираем PDF…"
                : files.length > 1 && file
                  ? `Скачать PDF для Ярмарки: ${file.label}`
                  : "Скачать PDF для Ярмарки"}
            </Button>
          ))}
          <p className="text-muted-foreground text-xs">
            {files.length === 0
              ? "Сначала добавьте PDF-бриф: к нему допишем страницу с QR-кодом и адресом stariva.ru/code."
              : "В конец брифа допишем страницу с QR-кодом и адресом stariva.ru/code — по ней покупатель с Ярмарки Мастеров введёт код."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
