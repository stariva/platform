import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { sessionFingerprint, verifyHlsGrant } from "@/lib/workshops/hls-token";

const secret = "synthetic-hls-test-secret";
const config = await import("@stariva/config");
const storage = await import("@stariva/storage");
let free = true;
let owned = true;
let rateLimited = false;
const materialFiles = [{ key: "brief.pdf", label: "Бриф" }];

mock.module("@stariva/config", () => ({
  ...config,
  env: { ...config.env, AUTH_SECRET: secret },
}));
mock.module("@stariva/storage", () => ({
  ...storage,
  isStorageConfigured: () => true,
  getDownloadUrl: async (key: string) => `https://storage.example.test/${key}`,
}));
mock.module("@/lib/workshops/video-access", () => ({
  isVideoSignRateLimited: async () => rateLimited,
  logVideoAccess: async () => {},
}));
const webApi = await import("@stariva/web-api");
mock.module("@stariva/web-api", () => ({
  ...webApi,
  hasAccess: async () => owned,
  getReadyRendition: async () => ({
    hlsPrefix: "workshops/test/hls/lesson/attempt",
  }),
}));
mock.module("@/lib/workshops/workshops-db", () => ({
  getWorkshopBySlug: async () => ({
    slug: "test",
    status: "published",
    materialFiles,
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

const { workshopFileServices } = await import("./signed-media");
const sign = (userId: string | null, cookie?: string) =>
  workshopFileServices.signLessonVideo({
    slug: "test",
    lessonId: "lesson",
    userId,
    headers: new Headers(cookie ? { cookie } : {}),
  });

test("signed-in requests without a session cookie fall back to MP4", async () => {
  free = false;
  for (const cookie of [undefined, "better-auth.session_token="]) {
    const result = await sign("user", cookie);
    assert.equal(result.status, "ok");
    assert.equal(result.status === "ok" && result.type, "mp4");
  }
});

test("signed-in HLS grants are bound to the incoming cookie", async () => {
  free = false;
  const result = await sign("user", "better-auth.session_token=token.sig");
  assert.ok(result.status === "ok" && result.type === "hls");
  const token = result.url.split("/").at(-2);
  assert.equal(
    verifyHlsGrant(token ?? "", secret)?.session,
    sessionFingerprint("token.sig"),
  );
});

test("anonymous previews retain an unbound HLS grant", async () => {
  free = true;
  const result = await sign(null);
  assert.ok(result.status === "ok" && result.type === "hls");
  assert.equal(
    verifyHlsGrant(result.url.split("/").at(-2) ?? "", secret)?.session,
    null,
  );
});

test("paid lessons need a session and a purchase", async () => {
  free = false;
  assert.deepEqual(await sign(null), { status: "unauthorized" });
  owned = false;
  assert.deepEqual(await sign("user"), { status: "forbidden" });
  owned = true;
});

test("a buyer past the link limit is refused", async () => {
  free = false;
  rateLimited = true;
  assert.deepEqual(await sign("user"), { status: "rate_limited" });
  rateLimited = false;
});

test("materials link to the site only for the course's own files", async () => {
  const material = (key: string, userId: string | null) =>
    workshopFileServices.signMaterial({ slug: "test", key, userId });
  assert.deepEqual(await material("other.pdf", "user"), {
    status: "not_found",
  });
  assert.deepEqual(await material("brief.pdf", null), {
    status: "unauthorized",
  });
  owned = false;
  assert.deepEqual(await material("brief.pdf", "user"), {
    status: "forbidden",
  });
  owned = true;
  assert.deepEqual(await material("brief.pdf", "user"), {
    status: "ok",
    url: "/api/workshops/test/materials/brief.pdf",
  });
});

test("material files are found by their name in the site link", async () => {
  const { findMaterialFile } = await import("./signed-media");
  assert.deepEqual(await findMaterialFile("test", "brief.pdf", "user"), {
    status: "ok",
    key: "brief.pdf",
    label: "Бриф",
  });
  assert.deepEqual(await findMaterialFile("test", "other.pdf", "user"), {
    status: "not_found",
  });
  assert.deepEqual(await findMaterialFile("test", "brief.pdf", null), {
    status: "unauthorized",
  });
});
