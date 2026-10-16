import { PRODUCT_IMAGE_TYPES } from "./catalog";

/**
 * Ключ копии чека НПД в публичном бакете. Чек не меняется после выписки,
 * поэтому ключ строится из ИНН и номера, а не из хеша: один чек — один файл.
 */
export function receiptImageKey(
  inn: string,
  number: string,
  contentType: string,
): string {
  const extension = PRODUCT_IMAGE_TYPES[contentType];
  if (!extension) throw new Error(`unsupported image type: ${contentType}`);
  return `receipts/${inn}/${number}.${extension}`;
}
