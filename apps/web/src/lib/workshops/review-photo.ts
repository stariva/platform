/** Длинная сторона фото в отзыве: на сайте больше не нужно. */
const MAX_SIDE = 1800;
const QUALITY = 0.85;

/**
 * Сжимает снимок с телефона в JPEG перед отправкой. Перерисовка через canvas
 * заодно выбрасывает EXIF — в том числе координаты, где сделан снимок: фото
 * попадёт на публичный сайт. Поворот из EXIF браузер применяет сам.
 *
 * Бросает ошибку, если браузер не смог открыть файл (например, HEIC в
 * Chrome на компьютере).
 */
export async function compressReviewPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_unavailable");
    // У PNG с прозрачностью фон стал бы чёрным
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob) throw new Error("encode_failed");
    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
