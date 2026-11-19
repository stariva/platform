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
    options.push({
      label: qualityLabel(
        Number(resolution?.[1] ?? 0),
        Number(resolution?.[2] ?? 0),
      ),
      index: options.length,
      url: new URL(path, masterUrl).href,
    });
  }
  return options.sort(
    (a, b) => Number.parseInt(b.label, 10) - Number.parseInt(a.label, 10),
  );
}
