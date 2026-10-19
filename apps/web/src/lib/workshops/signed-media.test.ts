import { mock, test } from "bun:test";
import assert from "node:assert/strict";
import { sessionFingerprint, verifyHlsGrant } from "@/lib/workshops/hls-token";

const secret = "synthetic-hls-test-secret";
const config = await import("@stariva/config");
const storage = await import("@stariva/storage");
let free = true;
let owned = true;
let admin = false;
let releaseAt: string | undefined;
let rateLimited = false;
const materialFiles = [
  { key: "brief.pdf", label: "Бриф" },
  { key: "workshops/test/materials/first/guide.pdf", label: "Первый файл" },
  { key: "workshops/test/materials/second/guide.pdf", label: "Второй файл" },
];

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
  canWatchCourse: async () => owned || admin,
  isAdminUserId: async () => admin,
  getReadyRendition: async () => ({
    hlsPrefix: "workshops/test/hls/lesson/attempt",
    playlist: "master.m3u8",
  }),
}));
mock.module("@/lib/workshops/workshops-db", () => ({
  getWorkshopBySlug: async () => ({
    slug: "test",
    status: "published",
    releaseAt,
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
  // Плейлист — тот, что у нарезки: у нескольких качеств master.m3u8
  assert.equal(result.url.split("/").at(-1), "master.m3u8");
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

test("before the start buyers wait, an admin watches without buying", async () => {
  free = false;
  releaseAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const waiting = await sign("user");
  assert.equal(waiting.status, "not_released");
  owned = false;
  admin = true;
  assert.equal((await sign("admin")).status, "ok");
  owned = true;
  admin = false;
  releaseAt = undefined;
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
  const result = await material("brief.pdf", "user");
  assert.ok(result.status === "ok");
  assert.match(
    result.url,
    /^\/api\/workshops\/test\/materials\/[a-f0-9]{64}\.pdf$/,
  );
});

test("material files are found by their identifier in the site link", async () => {
  const { findMaterialFile } = await import("./signed-media");
  const result = await workshopFileServices.signMaterial({
    slug: "test",
    key: "brief.pdf",
    userId: "user",
  });
  assert.ok(result.status === "ok");
  const fileId = result.url.split("/").at(-1) ?? "";
  assert.deepEqual(await findMaterialFile("test", fileId, "user"), {
    status: "ok",
    key: "brief.pdf",
    label: "Бриф",
  });
  assert.deepEqual(await findMaterialFile("test", "other.pdf", "user"), {
    status: "not_found",
  });
  assert.deepEqual(await findMaterialFile("test", "brief.pdf", "user"), {
    status: "not_found",
  });
  assert.deepEqual(await findMaterialFile("test", fileId, null), {
    status: "unauthorized",
  });
  owned = false;
  try {
    assert.deepEqual(await findMaterialFile("test", fileId, "user"), {
      status: "forbidden",
    });
  } finally {
    owned = true;
  }
});

test("materials with the same filename resolve to their own storage keys", async () => {
  const { findMaterialFile } = await import("./signed-media");
  const urls = new Set<string>();
  for (const material of materialFiles.slice(1)) {
    const result = await workshopFileServices.signMaterial({
      slug: "test",
      key: material.key,
      userId: "user",
    });
    assert.ok(result.status === "ok");
    urls.add(result.url);
    const file = decodeURIComponent(result.url.split("/").at(-1) ?? "");
    assert.deepEqual(await findMaterialFile("test", file, "user"), {
      status: "ok",
      ...material,
    });
  }
  assert.equal(urls.size, 2);
});
