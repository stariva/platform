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
