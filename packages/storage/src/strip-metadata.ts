/**
 * Убирает из фото метаданные, которые не должны попасть на публичный сайт:
 * EXIF (координаты съёмки, модель телефона), XMP, IPTC и текстовые блоки.
 * Пиксели не трогаем — файл не перекодируется.
 *
 * Браузер и так присылает перекодированный JPEG без EXIF, но запрос можно
 * отправить и мимо формы — сервер не полагается на клиента.
 *
 * null — файл повреждён: структура не разбирается.
 */
export function stripImageMetadata(
  bytes: Uint8Array,
  contentType: string,
): Uint8Array | null {
  switch (contentType) {
    case "image/jpeg":
      return stripJpeg(bytes);
    case "image/png":
      return stripPng(bytes);
    case "image/webp":
      return stripWebp(bytes);
    default:
      return null;
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// APP1 — EXIF и XMP, APP13 — IPTC/Photoshop, COM — комментарий
const JPEG_DROP = new Set([0xe1, 0xed, 0xfe]);

function stripJpeg(bytes: Uint8Array): Uint8Array | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    // Байты-заполнители 0xFF перед маркером
    let marker = bytes[i + 1];
    while (marker === 0xff) {
      i++;
      marker = bytes[i + 1];
    }
    if (marker === undefined) return null;
    // Начало данных изображения: дальше метаданных нет, копируем как есть
    if (marker === 0xda || marker === 0xd9) {
      parts.push(bytes.subarray(i));
      return concat(parts);
    }
    // Маркеры без длины (RSTn, TEM)
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      parts.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const high = bytes[i + 2];
    const low = bytes[i + 3];
    if (high === undefined || low === undefined) return null;
    const end = i + 2 + ((high << 8) | low);
    if (end > bytes.length) return null;
    if (!JPEG_DROP.has(marker)) parts.push(bytes.subarray(i, end));
    i = end;
  }
  return null;
}

// eXIf — EXIF, tEXt/zTXt/iTXt — текст (в iTXt лежит XMP), tIME — дата
const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function stripPng(bytes: Uint8Array): Uint8Array | null {
  if (!PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= bytes.length) {
    const length = view.getUint32(i);
    const end = i + 12 + length;
    if (end > bytes.length) return null;
    const type = String.fromCharCode(...bytes.subarray(i + 4, i + 8));
    if (!PNG_DROP.has(type)) parts.push(bytes.subarray(i, end));
    i = end;
    if (type === "IEND") return concat(parts);
  }
  return null;
}

const ascii = (bytes: Uint8Array, start: number) =>
  String.fromCharCode(...bytes.subarray(start, start + 4));

// Флаги VP8X: EXIF и XMP
const VP8X_EXIF = 0x08;
const VP8X_XMP = 0x04;

function stripWebp(bytes: Uint8Array): Uint8Array | null {
  if (ascii(bytes, 0) !== "RIFF" || ascii(bytes, 8) !== "WEBP") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= bytes.length) {
    const type = ascii(bytes, i);
    const size = view.getUint32(i + 4, true);
    // Чанки выровнены по чётной границе
    const end = i + 8 + size + (size % 2);
    if (i + 8 + size > bytes.length) return null;
    if (type === "VP8X") {
      const chunk = bytes.slice(i, Math.min(end, bytes.length));
      chunk[8] = (chunk[8] ?? 0) & ~(VP8X_EXIF | VP8X_XMP);
      chunks.push(chunk);
    } else if (type !== "EXIF" && type !== "XMP ") {
      chunks.push(bytes.subarray(i, Math.min(end, bytes.length)));
    }
    i = end;
  }
  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(bytes.subarray(0, 12));
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  return concat([header, body]);
}
