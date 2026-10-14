"use client";

import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { WorkshopMaterialFile } from "@/lib/workshops-data";

interface BriefDownloadsProps {
  slug: string;
  files: WorkshopMaterialFile[];
}

/** PDF курса внутри брифа: скачать заранее и распечатать до первого урока. */
export function BriefDownloads({ slug, files }: BriefDownloadsProps) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  async function download(file: WorkshopMaterialFile) {
    setLoadingKey(file.key);
    try {
      const res = await fetch(
        `/api/materials/sign?slug=${encodeURIComponent(slug)}&key=${encodeURIComponent(file.key)}`,
      );
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error || "Не удалось скачать файл");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Не удалось скачать файл");
    } finally {
      setLoadingKey(null);
    }
  }

  // Один файл — подписываем его названием, кнопка просто «Скачать PDF»
  const single = files.length === 1 ? files[0] : undefined;

  return (
    <div className="mb-7 flex flex-col gap-4 rounded-xl border border-espresso/8 bg-sand/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-start gap-3">
        <Printer
          className="mt-0.5 size-5 flex-shrink-0 text-terracotta"
          aria-hidden
        />
        <div>
          <p className="text-sm font-medium text-espresso">
            {single ? single.label : "Распечатайте перед началом"}
          </p>
          <p className="text-xs leading-relaxed text-espresso/70">
            {single
              ? "PDF — удобно распечатать и взять с собой в магазин"
              : "PDF — удобно распечатать и держать под рукой"}
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2 sm:flex-shrink-0">
        {files.map((file) => (
          <li key={file.key}>
            <button
              type="button"
              onClick={() => download(file)}
              disabled={loadingKey === file.key}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-espresso px-5 py-2.5 text-sm text-parchment transition-colors hover:bg-near-black disabled:opacity-60 sm:w-auto"
            >
              <Download className="size-4" aria-hidden />
              {loadingKey === file.key
                ? "Готовим файл…"
                : single
                  ? "Скачать PDF"
                  : file.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
