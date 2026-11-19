import { z } from "zod";

const variantSchema = z.object({
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  url: z.url({ protocol: /^https?$/ }),
});

function resolveUrl(path: string, base: string): string | null {
  try {
    return new URL(path, base).href;
  } catch {
    return null;
  }
}

export type QualityOption = { label: string; index: number; url?: string };

export function qualityLabel(width: number, height: number): string {
  const shortSide = Math.min(width, height);
  return shortSide > 0 ? `${shortSide}p` : "Исходное";
}

export function nativeHlsQualities(
  playlist: string,
  masterUrl: string,
): QualityOption[] {
  const lines = playlist.split(/\r?\n/);
  const options: QualityOption[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i]?.startsWith("#EXT-X-STREAM-INF:")) continue;
    const resolution = /RESOLUTION=(\d+)x(\d+)/.exec(lines[i] ?? "");
    const path = lines[i + 1]?.trim();
    if (!path || path.startsWith("#")) continue;
    // Плейлист пришёл из сети: битую запись пропускаем, остальные оставляем
    const entry = variantSchema.safeParse({
      width: Number(resolution?.[1] ?? 0),
      height: Number(resolution?.[2] ?? 0),
      url: resolveUrl(path, masterUrl),
    });
    if (!entry.success) continue;
    options.push({
      label: qualityLabel(entry.data.width, entry.data.height),
      index: options.length,
      url: entry.data.url,
    });
  }
  return options.sort(
    (a, b) => Number.parseInt(b.label, 10) - Number.parseInt(a.label, 10),
  );
}
