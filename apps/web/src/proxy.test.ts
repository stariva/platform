import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import {
  ATTRIBUTION_COOKIE,
  attributionFromRequest,
  UTM_KEYS,
} from "./lib/campaign-attribution";
import { proxy } from "./proxy";

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
