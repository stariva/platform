/**
 * Части сообщений чата хранятся как UIMessage parts из AI SDK. Админке
 * незачем знать их формат: сводим к тексту и коротким подписям о том,
 * что Ника нашла инструментами.
 */

export type TranscriptPart =
  | { type: "text"; text: string }
  | {
      type: "tool";
      // Имя инструмента из apps/web/src/lib/chat/tools.ts
      tool: string;
      label: string;
      // Что искали: запрос или параметры расчёта
      detail?: string;
      items: { title: string; url?: string }[];
      failed: boolean;
    };

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

const TOOL_LABELS: Record<string, string> = {
  searchProducts: "Искала изделия в каталоге",
  estimateCustomOrder: "Посчитала стоимость заказа",
  findWorkshops: "Подбирала мастер-классы",
  searchArticles: "Искала статьи",
  getContacts: "Показала контакты",
};

function cards(list: unknown, titleKey: "name" | "title") {
  if (!Array.isArray(list)) return [];
  return list.filter(isObject).map((card) => ({
    title: str(card[titleKey]) ?? "Без названия",
    url: str(card.url),
  }));
}

function toolPart(name: string, part: Json): TranscriptPart {
  const input = isObject(part.input) ? part.input : {};
  const output = isObject(part.output) ? part.output : {};
  // Ошибка инструмента или ответ оборвался, не дождавшись результата
  const failed = part.state !== "output-available" || "error" in output;

  let detail = str(input.query);
  let items: { title: string; url?: string }[] = [];
  switch (name) {
    case "searchProducts":
      items = cards(output.products, "name");
      break;
    case "findWorkshops":
      items = cards(output.workshops, "title");
      break;
    case "searchArticles":
      items = cards(output.articles, "title");
      break;
    case "estimateCustomOrder":
      detail = [
        output.productLabel,
        output.sizeLabel,
        output.colorLabel,
        output.complexityLabel,
      ]
        .map(str)
        .filter(Boolean)
        .join(", ");
      if (str(output.rangeFormatted)) {
        items = [{ title: String(output.rangeFormatted) }];
      }
      break;
  }

  return {
    type: "tool",
    tool: name,
    label: TOOL_LABELS[name] ?? name,
    detail: detail || undefined,
    items,
    failed,
  };
}

/** Текст и инструменты сообщения в порядке, как их видел посетитель. */
export function toTranscriptParts(parts: unknown[]): TranscriptPart[] {
  const result: TranscriptPart[] = [];
  for (const part of parts) {
    if (!isObject(part) || typeof part.type !== "string") continue;
    if (part.type === "text") {
      const text = str(part.text);
      if (text) result.push({ type: "text", text });
    } else if (part.type.startsWith("tool-")) {
      result.push(toolPart(part.type.slice("tool-".length), part));
    } else if (part.type === "dynamic-tool" && str(part.toolName)) {
      result.push(toolPart(String(part.toolName), part));
    }
  }
  return result;
}

/** Начало вопроса для списка диалогов. */
export function previewText(parts: unknown[], maxLength = 140) {
  const text = toTranscriptParts(parts)
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength
    ? `${text.slice(0, maxLength - 1).trimEnd()}…`
    : text;
}
