import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import {
  ATTRIBUTION_COOKIE,
  attributionFromRequest,
  UTM_KEYS,
} from "./lib/campaign-attribution";
import {
  pageContentSecurityPolicy,
  staticContentSecurityPolicy,
} from "./lib/csp";
import { config, proxy } from "./proxy";

test("proxy bounds encoded Unicode cookies and updates last on repeat visits", () => {
  for (const label of ["я", "界", "😀"]) {
    let cookie = "";
    for (const campaign of [label, "新"]) {
      const url = new URL(`https://stariva.ru/${"п".repeat(200)}`);
      for (const key of UTM_KEYS) {
        url.searchParams.set(key, campaign.repeat(120));
      }
      const response = proxy(
        new NextRequest(url, {
          headers: {
            cookie,
            referer: `https://${"a".repeat(60)}.example.com/`,
          },
        }),
      );
      const header = response.headers.get("set-cookie");
      assert.ok(header);
      const [pair] = header.split(";");
      assert.ok(pair);
      cookie = pair;
      assert.ok(cookie.startsWith(`${ATTRIBUTION_COOKIE}=`));
      assert.ok(Buffer.byteLength(cookie) <= 4096);
      const attribution = attributionFromRequest(
        new Request(url, { headers: { cookie } }),
      );
      assert.ok(attribution);
      for (const key of UTM_KEYS) {
        assert.ok(attribution.first[key]?.startsWith(label));
        assert.ok(attribution.last[key]?.startsWith(campaign));
      }
      assert.ok(attribution.first.at);
      assert.ok(attribution.last.at);
    }
  }
});

function scriptSrc(policy: string | null) {
  return policy?.split("; ").find((d) => d.startsWith("script-src ")) ?? "";
}

test("proxy gives every page a fresh nonce and passes it to rendering", () => {
  const nonces = new Set<string>();
  for (let i = 0; i < 2; i++) {
    const response = proxy(new NextRequest("https://stariva.ru/catalog"));
    const policy = response.headers.get("content-security-policy");
    const nonce = scriptSrc(policy).match(/'nonce-([^']+)'/)?.[1];
    assert.ok(nonce);
    nonces.add(nonce);
    // Next читает nonce из CSP запроса, переданного через x-middleware-override
    assert.equal(
      response.headers.get("x-middleware-request-content-security-policy"),
      policy,
    );
  }
  assert.equal(nonces.size, 2);
});

test("proxy keeps the CSP on the sign-in redirect", () => {
  const response = proxy(new NextRequest("https://stariva.ru/account/orders"));
  assert.equal(response.status, 307);
  assert.ok(response.headers.get("content-security-policy"));
});

test("production page policy has no inline or eval scripts", () => {
  const policy = pageContentSecurityPolicy({ nonce: "abc", isDev: false });
  const scripts = scriptSrc(policy);
  assert.match(scripts, /'nonce-abc' 'strict-dynamic'/);
  assert.doesNotMatch(scripts, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(policy, /(connect|img)-src[^;]* https:(;| |$)/);
  assert.match(policy, /upgrade-insecure-requests/);
  assert.doesNotMatch(
    scriptSrc(staticContentSecurityPolicy({ isDev: false })),
    /unsafe/,
  );
});

test("proxy runs on every page but skips API, PostHog and files", () => {
  // unstable_doesMiddlewareMatch из next/experimental/testing ломает соседние
  // тесты в общем процессе bun, поэтому проверяем сам шаблон: путь без
  // именованных параметров Next превращает в такое же регулярное выражение.
  const [source] = config.matcher;
  assert.ok(source);
  const matches = (url: string) => new RegExp(`^${source}$`).test(url);
  for (const url of [
    "/",
    "/catalog",
    "/catalog/interior/abazhur",
    "/workshops/abazhur-mk",
    "/checkout",
    "/account/orders",
    "/order/abc",
  ]) {
    assert.ok(matches(url), `${url} must get a nonce`);
  }
  for (const url of [
    "/api/rpc/catalog",
    "/ingest/e/",
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/robots.txt",
    "/sitemap.xml",
    "/favicon.ico",
  ]) {
    assert.ok(!matches(url), url);
  }
});
