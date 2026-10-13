import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { sessionFingerprint, verifyHlsGrant } from "@/lib/workshops/hls-token";

const secret = "synthetic-hls-test-secret";
const config = await import("@stariva/config");
const storage = await import("@stariva/storage");
let session: { user: { id: string } } | null = null;
let free = true;

mock.module("@stariva/config", () => ({
  ...config,
  env: { ...config.env, AUTH_SECRET: secret },
}));
mock.module("@stariva/storage", () => ({
  ...storage,
  isStorageConfigured: () => true,
  getDownloadUrl: async () => "https://storage.example.test/lesson.mp4",
}));
mock.module("@/lib/auth/session", () => ({
  getSession: async () => session,
}));
mock.module("@/lib/account/access", () => ({ hasAccess: async () => true }));
mock.module("@/lib/workshops/video-access", () => ({
  isVideoSignRateLimited: async () => false,
  logVideoAccess: async () => {},
}));
mock.module("@/lib/workshops/video-renditions", () => ({
  getReadyRendition: async () => ({
    hlsPrefix: "workshops/test/hls/lesson/attempt",
  }),
}));
mock.module("@/lib/workshops/workshops-db", () => ({
  getWorkshopBySlug: async () => ({
    slug: "test",
    status: "published",
    lessons: [
      {
        id: "lesson",
        title: "Lesson",
        durationSeconds: 60,
        videoKey: "workshops/test/lesson.mp4",
        free,
      },
    ],
  }),
}));

const { GET } = await import("./route");
const request = (cookie?: string) =>
  new NextRequest(
    "https://example.test/api/video/sign?slug=test&lessonId=lesson",
    {
      headers: cookie ? { cookie } : {},
    },
  );

test("signed-in requests without a session cookie fall back to MP4", async () => {
  session = { user: { id: "user" } };
  free = false;
  for (const cookie of [undefined, "better-auth.session_token="]) {
    const response = await GET(request(cookie));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal((await response.json()).type, "mp4");
  }
});

test("signed-in HLS grants are bound to the incoming cookie", async () => {
  session = { user: { id: "user" } };
  free = false;
  const response = await GET(request("better-auth.session_token=token.sig"));
  const body = await response.json();
  assert.equal(body.type, "hls");
  const token = body.url.split("/").at(-2);
  assert.equal(
    verifyHlsGrant(token, secret)?.session,
    sessionFingerprint("token.sig"),
  );
});

test("anonymous previews retain an unbound HLS grant", async () => {
  session = null;
  free = true;
  const response = await GET(request());
  const body = await response.json();
  assert.equal(body.type, "hls");
  assert.equal(
    verifyHlsGrant(body.url.split("/").at(-2), secret)?.session,
    null,
  );
});
