import { expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import {
  CSP_REPORT_PATH,
  pageContentSecurityPolicy,
  REPORTING_ENDPOINTS,
  staticContentSecurityPolicy,
} from "./csp";

const directives = (policy: string) =>
  new Map(
    policy.split("; ").map((directive) => {
      const [name = "", ...values] = directive.split(" ");
      return [name, values.join(" ")];
    }),
  );

test("the page policy sends violations to the report endpoint", () => {
  const policy = directives(
    pageContentSecurityPolicy({ nonce: "abc", isDev: false }),
  );
  expect(policy.get("report-uri")).toBe(CSP_REPORT_PATH);
  expect(policy.get("report-to")).toBe("csp");
  expect(policy.get("script-src")).toContain("'nonce-abc' 'strict-dynamic'");
  expect(REPORTING_ENDPOINTS).toBe(`csp="${CSP_REPORT_PATH}"`);
});

test("dev pages report through report-uri only", () => {
  // Chrome ignores Reporting-Endpoints on http://localhost, and report-to
  // would switch report-uri off
  const policy = directives(
    pageContentSecurityPolicy({ nonce: "abc", isDev: true }),
  );
  expect(policy.get("report-uri")).toBe(CSP_REPORT_PATH);
  expect(policy.has("report-to")).toBe(false);
});

test("the static policy for API responses does not report", () => {
  const policy = directives(staticContentSecurityPolicy({ isDev: false }));
  expect(policy.has("report-uri")).toBe(false);
  expect(policy.has("report-to")).toBe(false);
});

test("pages get the reporting endpoint next to their nonce policy", () => {
  const response = proxy(new NextRequest("https://stariva.ru/catalog"));
  const policy = response.headers.get("Content-Security-Policy") ?? "";
  expect(response.headers.get("Reporting-Endpoints")).toBe(REPORTING_ENDPOINTS);
  expect(directives(policy).get("report-to")).toBe("csp");
  expect(policy).toMatch(/'nonce-[^']+'/);
});
