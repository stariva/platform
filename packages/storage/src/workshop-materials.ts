import { getObjectBytes } from "./s3";
import { workshopMaterialFileName } from "./workshops";

/**
 * Скачивает PDF-материалы курса из закрытого бакета, чтобы приложить их к
 * письму. Не скачался хоть один файл — ошибка: половина брифа хуже никакого.
 */
export function loadWorkshopMaterials(
  files: ReadonlyArray<{ label: string; key: string }>,
) {
  return Promise.all(
    files.map(async (file) => ({
      label: file.label,
      filename: workshopMaterialFileName(file.label),
      content: await getObjectBytes(file.key),
    })),
  );
}
