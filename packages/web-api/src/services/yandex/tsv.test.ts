import { expect, test } from "bun:test";
import {
  parseArrayLiteral,
  parseDirectTsv,
  parseLogsTsv,
  unescapeValue,
} from "./tsv";

test("unescapes ClickHouse TSV strings", () => {
  expect(unescapeValue("a\\tb\\nc\\\\d\\'e")).toBe("a\tb\nc\\d'e");
});

test("parses array literals, keeping long ids as strings", () => {
  expect(parseArrayLiteral("[]")).toEqual([]);
  expect(parseArrayLiteral("[671496722,1,2.5]")).toEqual([671496722, 1, 2.5]);
  expect(parseArrayLiteral("[17293748123456789012]")).toEqual([
    "17293748123456789012",
  ]);
  expect(
    parseArrayLiteral("['2026-10-20 12:00:00','it\\'s, ok','tab\\there']"),
  ).toEqual(["2026-10-20 12:00:00", "it's, ok", "tab\there"]);
  expect(parseArrayLiteral("not an array")).toBeNull();
  expect(parseArrayLiteral("['unterminated]")).toBeNull();
});

test("parses a Logs API part into records without prefixes", () => {
  const tsv = [
    "ym:s:visitID\tym:s:startURL\tym:s:goalsID\tym:s:purchaseID\tym:s:referer",
    "123\thttps://stariva.ru/elka?a=1\\tb\t[671496722]\t['ord-1']\t",
    "",
  ].join("\n");
  expect(parseLogsTsv(tsv)).toEqual([
    {
      visitID: "123",
      startURL: "https://stariva.ru/elka?a=1\tb",
      goalsID: [671496722],
      purchaseID: ["ord-1"],
    },
  ]);
});

test("keeps a title that only looks like an array as text", () => {
  const tsv = "ym:pv:title\tym:pv:goalsID\n[Скидка] Ёлка макраме\t[]\n";
  expect(parseLogsTsv(tsv)).toEqual([{ title: "[Скидка] Ёлка макраме" }]);
});

test("parses a Direct report and drops «--»", () => {
  const tsv =
    "Date\tCampaignId\tAge\tConversions_671496722_AUTO\r\n2026-10-20\t715338803\t--\t1\r\n";
  expect(parseDirectTsv(tsv)).toEqual([
    {
      Date: "2026-10-20",
      CampaignId: "715338803",
      Conversions_671496722_AUTO: "1",
    },
  ]);
});
