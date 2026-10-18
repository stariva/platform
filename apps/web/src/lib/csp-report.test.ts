import { expect, test } from "bun:test";
import {
  LogBudget,
  MAX_REPORTS_PER_REQUEST,
  parseCspReports,
  reportUrl,
} from "./csp-report";

test("report URLs keep only origin and path", () => {
  expect(reportUrl("https://mc.yandex.ru/watch/1?page-url=x#y")).toBe(
    "https://mc.yandex.ru/watch/1",
  );
  expect(reportUrl("wss://mc.yandex.ru/solid.ws?wv-id=1")).toBe(
    "wss://mc.yandex.ru/solid.ws",
  );
  expect(reportUrl("https://stariva.ru/api/workshops/access/t0k/watch")).toBe(
    "https://stariva.ru/api/workshops/access/:token/watch",
  );
  expect(reportUrl("blob:https://stariva.ru/1234")).toBe("blob:");
  expect(reportUrl("eval")).toBe("eval");
  expect(reportUrl("not a url?with=query")).toBe("invalid");
  expect(reportUrl(42)).toBeUndefined();
});

test("a report without document URL or directive is skipped", () => {
  expect(
    parseCspReports({ "csp-report": { "blocked-uri": "inline" } }),
  ).toEqual([]);
  expect(
    parseCspReports([{ type: "csp-violation", body: { documentURL: "x" } }]),
  ).toEqual([]);
});

test("only the first reports of a huge batch are parsed", () => {
  const report = {
    type: "csp-violation",
    body: {
      documentURL: "https://stariva.ru/",
      blockedURL: "inline",
      effectiveDirective: "script-src-elem",
    },
  };
  const batch = Array.from({ length: 500 }, () => report);
  expect(parseCspReports(batch)).toHaveLength(MAX_REPORTS_PER_REQUEST);
});

test("the log budget drops reports over the limit and reports the drop count", () => {
  const budget = new LogBudget(2);
  const start = 1_000_000;
  expect(budget.take(start).allowed).toBe(true);
  expect(budget.take(start + 1).allowed).toBe(true);
  expect(budget.take(start + 2).allowed).toBe(false);
  expect(budget.take(start + 3).allowed).toBe(false);

  expect(budget.take(start + 60_000)).toEqual({
    allowed: true,
    droppedBefore: 2,
  });
  expect(budget.take(start + 60_001)).toEqual({
    allowed: true,
    droppedBefore: 0,
  });
});
