/**
 * Разбор TSV из Logs API Метрики и Reports API Директа.
 *
 * Logs API пишет TSV в формате ClickHouse: в строках экранированы \t, \n и
 * \\, а массивы — литералы вида [1,2] и ['a','b'] со своим экранированием
 * внутри кавычек. Директ отдаёт простой TSV, где пустое значение — «--».
 */

const ESCAPES: Record<string, string> = {
  t: "\t",
  n: "\n",
  r: "\r",
  "0": "\0",
  b: "\b",
  f: "\f",
};

/** Снимает экранирование ClickHouse: \t, \n, \\, \' и т. п. */
export function unescapeValue(value: string): string {
  return value.replace(/\\(.)/gs, (_, char: string) => ESCAPES[char] ?? char);
}

/**
 * Литерал массива ClickHouse: числа и строки в одинарных кавычках. Числа,
 * которые JavaScript хранит без потерь, — числами, длинные id — строками.
 * Не массив или битый литерал — null.
 */
export function parseArrayLiteral(
  value: string,
): Array<string | number> | null {
  if (!value.startsWith("[") || !value.endsWith("]")) return null;
  const items: Array<string | number> = [];
  let i = 1;
  const end = value.length - 1;
  while (i < end) {
    const char = value[i];
    if (char === "," || char === " ") {
      i++;
      continue;
    }
    if (char === "'") {
      let text = "";
      i++;
      while (i < end && value[i] !== "'") {
        if (value[i] === "\\" && i + 1 < end) {
          const next = value[i + 1] as string;
          text += ESCAPES[next] ?? next;
          i += 2;
        } else {
          text += value[i];
          i++;
        }
      }
      if (value[i] !== "'") return null;
      items.push(text);
      i++;
      continue;
    }
    let raw = "";
    while (i < end && value[i] !== ",") {
      raw += value[i];
      i++;
    }
    raw = raw.trim();
    const exact =
      /^-?\d+\.\d+$/.test(raw) ||
      (/^-?\d+$/.test(raw) && Number.isSafeInteger(Number(raw)));
    items.push(exact ? Number(raw) : raw);
  }
  return items;
}

/** Заголовок и строки TSV; пустые строки в конце отбрасываются. */
export function splitTsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  while (lines.length && lines.at(-1) === "") lines.pop();
  const [head, ...rest] = lines;
  return {
    header: head ? head.split("\t") : [],
    rows: rest.map((line) => line.split("\t")),
  };
}

/** Поля-массивы в Logs API: id просмотров, цели, покупки, товары, параметры. */
const ARRAY_FIELD =
  /^(watchIDs|goals[A-Z]|purchase[A-Z]|product[A-Z]|purchasedProduct|impressions|promotion|parsedParamsKey)/;

/**
 * Строки Logs API как объекты: имена полей без ym:s: / ym:pv:, пустые
 * значения пропущены, массивы разобраны.
 */
export function parseLogsTsv(text: string): Array<Record<string, unknown>> {
  const { header, rows } = splitTsv(text);
  const names = header.map((name) => name.replace(/^ym:(s|pv):/, ""));
  return rows.map((row) => {
    const record: Record<string, unknown> = {};
    names.forEach((name, index) => {
      const raw = row[index];
      if (raw === undefined || raw === "") return;
      if (ARRAY_FIELD.test(name)) {
        const items = parseArrayLiteral(raw);
        if (items?.length) record[name] = items;
        else if (!items) record[name] = unescapeValue(raw);
        return;
      }
      record[name] = unescapeValue(raw);
    });
    return record;
  });
}

/** Строки отчёта Директа как объекты; «--» (нет данных) пропускается. */
export function parseDirectTsv(text: string): Array<Record<string, string>> {
  const { header, rows } = splitTsv(text);
  return rows.map((row) => {
    const record: Record<string, string> = {};
    header.forEach((name, index) => {
      const value = row[index];
      if (value !== undefined && value !== "" && value !== "--")
        record[name] = value;
    });
    return record;
  });
}
