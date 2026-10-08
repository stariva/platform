import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const SECRET = "s".repeat(40);
const revalidatePath = mock((_path: string) => {});

mock.module("next/cache", () => ({ revalidatePath }));
// mock.module в bun глобален для всего прогона: подменяем только baseEnv,
// остальные экспорты (env) оставляем, иначе другие тесты ломаются.
const actualEnv = await import("@/env");
mock.module("@/env", () => ({
  ...actualEnv,
  baseEnv: { REVALIDATE_SECRET: SECRET },
}));

const { POST } = await import("./route");

const request = (body: unknown, auth?: string) =>
  new NextRequest("http://localhost/api/revalidate", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
    body: JSON.stringify(body),
  });

test("rejects a missing or wrong secret", async () => {
  revalidatePath.mockClear();
  assert.equal((await POST(request({ paths: ["/"] }))).status, 401);
  assert.equal(
    (await POST(request({ paths: ["/"] }, "Bearer wrong"))).status,
    401,
  );
  assert.equal(revalidatePath.mock.calls.length, 0);
});

test("revalidates the requested paths", async () => {
  revalidatePath.mockClear();
  const res = await POST(
    request(
      { paths: ["/catalog/interior/abazhur-4756", "/sitemap.xml"] },
      `Bearer ${SECRET}`,
    ),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(
    revalidatePath.mock.calls.map(([path]) => path),
    ["/catalog/interior/abazhur-4756", "/sitemap.xml"],
  );
});

test("rejects anything that is not a page path", async () => {
  for (const paths of [[], ["https://evil.example/"], ["/a?b=1"]]) {
    assert.equal(
      (await POST(request({ paths }, `Bearer ${SECRET}`))).status,
      400,
    );
  }
});
