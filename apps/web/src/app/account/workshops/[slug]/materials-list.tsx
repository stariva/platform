"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { WorkshopMaterialFile } from "@/lib/workshops-data";

interface MaterialsListProps {
  slug: string;
  materials: WorkshopMaterialFile[];
}

export function MaterialsList({ slug, materials }: MaterialsListProps) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  async function download(material: WorkshopMaterialFile) {
    setLoadingKey(material.key);
    try {
      const res = await fetch(
        `/api/materials/sign?slug=${encodeURIComponent(slug)}&key=${encodeURIComponent(material.key)}`,
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

  if (materials.length === 0) return null;

  return (
    <div className="bg-white border border-espresso/10 rounded-2xl p-6 mb-6">
      <h3 className="font-serif text-lg text-espresso mb-3">Материалы курса</h3>
      <ul className="space-y-2">
        {materials.map((material) => (
          <li key={material.key}>
            <button
              type="button"
              onClick={() => download(material)}
              disabled={loadingKey === material.key}
              className="flex items-center gap-3 text-sm text-espresso/80 hover:text-terracotta transition-colors w-full text-left disabled:opacity-50"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                aria-hidden="true"
                className="flex-shrink-0 text-terracotta"
              >
                <path
                  d="M9 2v9m0 0l-3.5-3.5M9 11l3.5-3.5M3 14h12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {loadingKey === material.key ? "Готовим файл…" : material.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
