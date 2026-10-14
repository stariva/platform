import { expect, mock, test } from "bun:test";
import type { Session } from "@stariva/auth";
import type { UpsertProgressInput } from "../services/course-access";

let owned = true;
let lessons = ["lesson-1"];
let saved: UpsertProgressInput[] = [];
mock.module("../services/course-access", () => ({
  hasAccess: async () => owned,
  lessonExists: async (_slug: string, lessonId: string) =>
    lessons.includes(lessonId),
  upsertLessonProgress: async (input: UpsertProgressInput) => {
    saved.push(input);
  },
}));

const { safe } = await import("@orpc/client");
const { LessonNotFoundError } = await import("../contract");
const { lastStatus, wireClient } = await import("../testing/wire-client");

const session = { user: { id: "user-1" } } as Session;
const progress = {
  slug: "lampshade",
  lessonId: "lesson-1",
  positionSeconds: 120,
  durationSeconds: 600,
};

test("anonymous visitor has no access and is not signed in", async () => {
  const result = await wireClient().account.workshopAccess({
    slug: "lampshade",
  });
  expect(result).toEqual({ authenticated: false, owned: false });
});

test("signed-in buyer sees the course as owned", async () => {
  owned = true;
  const result = await wireClient({ session }).account.workshopAccess({
    slug: "lampshade",
  });
  expect(result).toEqual({ authenticated: true, owned: true });
});

test("progress requires a session", async () => {
  saved = [];
  const [error] = await safe(wireClient().account.saveLessonProgress(progress));
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(lastStatus()).toBe(401);
  expect(saved).toEqual([]);
});

test("progress of an unknown lesson is refused", async () => {
  lessons = [];
  const [error] = await safe(
    wireClient({ session }).account.saveLessonProgress(progress),
  );
  lessons = ["lesson-1"];
  expect(error).toBeInstanceOf(LessonNotFoundError);
  expect(lastStatus()).toBe(404);
});

test("progress is saved only for buyers of the course", async () => {
  saved = [];
  owned = false;
  const [error] = await safe(
    wireClient({ session }).account.saveLessonProgress(progress),
  );
  owned = true;
  expect(error).toMatchObject({ code: "FORBIDDEN" });
  expect(lastStatus()).toBe(403);
  expect(saved).toEqual([]);
});

test("buyer's progress is saved for their user", async () => {
  saved = [];
  await wireClient({ session }).account.saveLessonProgress({
    ...progress,
    completed: true,
  });
  expect(saved).toEqual([
    {
      userId: "user-1",
      workshopSlug: "lampshade",
      lessonId: "lesson-1",
      positionSeconds: 120,
      durationSeconds: 600,
      completed: true,
    },
  ]);
});

const lessonRequest = { slug: "lampshade", lessonId: "lesson-1" };

test("lesson video link is passed through", async () => {
  const result = await wireClient().account.lessonVideo(lessonRequest);
  expect(result).toMatchObject({ type: "mp4", expiresIn: 900 });
});

test("lesson video refusals become typed errors", async () => {
  const cases = [
    ["lesson_not_found", "LESSON_NOT_FOUND", 404],
    ["video_not_uploaded", "VIDEO_NOT_UPLOADED", 404],
    ["files_unavailable", "FILES_UNAVAILABLE", 503],
    ["rate_limited", "VIDEO_RATE_LIMITED", 429],
    ["unauthorized", "UNAUTHORIZED", 401],
    ["forbidden", "FORBIDDEN", 403],
  ] as const;
  for (const [status, code, http] of cases) {
    const [error] = await safe(
      wireClient({
        services: {
          workshopFiles: {
            signLessonVideo: async () => ({ status }),
            signMaterial: async () => ({ status: "not_found" }),
          },
        },
      }).account.lessonVideo(lessonRequest),
    );
    expect(error).toMatchObject({ code });
    expect(lastStatus()).toBe(http);
  }
});

test("a preorder lesson tells the buyer when it opens", async () => {
  const [error] = await safe(
    wireClient({
      services: {
        workshopFiles: {
          signLessonVideo: async () => ({
            status: "not_released",
            message: "Урок откроется 1 ноября в 10:00",
          }),
          signMaterial: async () => ({ status: "not_found" }),
        },
      },
    }).account.lessonVideo(lessonRequest),
  );
  expect(error).toMatchObject({
    code: "LESSON_NOT_RELEASED",
    message: "Урок откроется 1 ноября в 10:00",
  });
  expect(lastStatus()).toBe(403);
});

test("lesson video is asked for the signed-in user", async () => {
  const signLessonVideo = mock(async () => ({
    status: "forbidden" as const,
  }));
  await safe(
    wireClient({
      session,
      services: {
        workshopFiles: {
          signLessonVideo,
          signMaterial: async () => ({ status: "not_found" }),
        },
      },
    }).account.lessonVideo(lessonRequest),
  );
  expect(signLessonVideo).toHaveBeenCalledWith(
    expect.objectContaining({ ...lessonRequest, userId: "user-1" }),
  );
});

test("material link is passed through and refusals are typed", async () => {
  const material = { slug: "lampshade", key: "brief.pdf" };
  const ok = await wireClient({ session }).account.materialUrl(material);
  expect(ok.url).toContain("brief.pdf");

  const [error] = await safe(
    wireClient({
      services: {
        workshopFiles: {
          signLessonVideo: async () => ({ status: "lesson_not_found" }),
          signMaterial: async () => ({ status: "unauthorized" }),
        },
      },
    }).account.materialUrl(material),
  );
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(lastStatus()).toBe(401);
});
