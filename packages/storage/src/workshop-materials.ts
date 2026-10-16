import { getDownloadUrl, objectExists } from "./s3";
import { workshopMaterialFileName } from "./workshops";

/** Сколько живёт ссылка: Resend скачивает файл в момент отправки письма. */
const LINK_TTL_SECONDS = 6 * 3600;

/**
 * Готовит PDF-материалы курса к вложению в письмо: проверяет, что файлы есть в
 * закрытом бакете, и выдаёт на них временные ссылки. Сами файлы через сервер не
 * гоняем: большое тело запроса к Resend с нашего хоста зависает, а по ссылке
 * его скачивает сам Resend. Нет хоть одного файла — ошибка: половина брифа
 * хуже никакого.
 */
export function loadWorkshopMaterials(
  files: ReadonlyArray<{ label: string; key: string }>,
) {
  return Promise.all(
    files.map(async (file) => {
      if (!(await objectExists(file.key))) {
        throw new Error(`workshop material not found: ${file.key}`);
      }
      return {
        label: file.label,
        filename: workshopMaterialFileName(file.label),
        url: await getDownloadUrl(file.key, { expiresIn: LINK_TTL_SECONDS }),
      };
    }),
  );
}
