import { expect, mock, test } from "bun:test";
import type { Session } from "@stariva/auth";
import type { LessonDetails } from "../contract";

const details: LessonDetails = {
  slug: "lampshade",
  workshopTitle: "Абажур",
  lessonId: "lesson-1",
  title: "Нарезка шнура",
  durationSeconds: 600,
  positionSeconds: 255,
  completed: false,
  chapters: [{ time: 0, title: "Нарезка" }],
  checklist: [{ id: "cord", label: "Шнур 4 мм — 12 отрезков по 3,5 м" }],
  checkedMaterials: [],
  attachments: [],
  lessons: [],
};

let lessonResult:
  | { status: "ok"; details: LessonDetails }
  | { status: "not_found" | "unauthorized" | "forbidden" } = {
  status: "ok",
  details,
};
let checklistResult: "ok" | "not_found" | "forbidden" = "ok";
let checklistCalls: unknown[] = [];

mock.module("../services/mobile-courses", () => ({
  listCatalogCourses: async () => [{
    slug: "lampshade",
    title: "Абажур",
    subtitle: "",
    description: "Видеокурс",
    cover: "/images/lampshade.jpg",
    category: "lampshades",
    level: "beginner",
    priceKopecks: 99000,
    lessonCount: 4,
    isPreorder: false,
  }],
  listMobileCourses: async () => ({ courses: [], resume: null, demo: null }),
  getLessonDetails: async () => lessonResult,
  saveLessonChecklist: async (input: unknown) => {
    checklistCalls.push(input);
    return checklistResult;
  },
  getLatestRelease: async () => null,
}));

const { safe } = await import("@orpc/client");
const { LessonNotFoundError } = await import("../contract");
const { lastStatus, wireClient } = await import("../testing/wire-client");

const session = { user: { id: "user-1" } } as Session;
const lesson = { slug: "lampshade", lessonId: "lesson-1" };

test("catalog is available before sign-in", async () => {
  const courses = await wireClient().account.catalogCourses();
  expect(courses[0]).toMatchObject({ slug: "lampshade", priceKopecks: 99000 });
});

test("my courses require a session", async () => {
  const [error] = await safe(wireClient().account.myCourses());
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(lastStatus()).toBe(401);
});

test("signed-in buyer gets their courses", async () => {
  const result = await wireClient({ session }).account.myCourses();
  expect(result).toEqual({ courses: [], resume: null, demo: null });
});

test("lesson details are passed through", async () => {
  lessonResult = { status: "ok", details };
  const result = await wireClient({ session }).account.lessonDetails(lesson);
  expect(result.title).toBe("Нарезка шнура");
});

test("lesson details refusals become typed errors", async () => {
  lessonResult = { status: "not_found" };
  const [missing] = await safe(
    wireClient({ session }).account.lessonDetails(lesson),
  );
  expect(missing).toBeInstanceOf(LessonNotFoundError);
  expect(lastStatus()).toBe(404);

  lessonResult = { status: "unauthorized" };
  const [anonymous] = await safe(wireClient().account.lessonDetails(lesson));
  expect(anonymous).toMatchObject({ code: "UNAUTHORIZED" });
  expect(lastStatus()).toBe(401);

  lessonResult = { status: "forbidden" };
  const [stranger] = await safe(
    wireClient({ session }).account.lessonDetails(lesson),
  );
  expect(stranger).toMatchObject({ code: "FORBIDDEN" });
  expect(lastStatus()).toBe(403);
});

test("checklist requires a session", async () => {
  checklistCalls = [];
  const [error] = await safe(
    wireClient().account.saveLessonChecklist({
      ...lesson,
      checkedMaterials: ["cord"],
    }),
  );
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(checklistCalls).toEqual([]);
});

test("checklist is saved for the signed-in buyer", async () => {
  checklistCalls = [];
  checklistResult = "ok";
  await wireClient({ session }).account.saveLessonChecklist({
    ...lesson,
    checkedMaterials: ["cord"],
  });
  expect(checklistCalls).toEqual([
    { userId: "user-1", ...lesson, checkedMaterials: ["cord"] },
  ]);
});

test("checklist of a foreign course is refused", async () => {
  checklistResult = "forbidden";
  const [error] = await safe(
    wireClient({ session }).account.saveLessonChecklist({
      ...lesson,
      checkedMaterials: [],
    }),
  );
  expect(error).toMatchObject({ code: "FORBIDDEN" });
  expect(lastStatus()).toBe(403);
});

test("latest release is public and may be empty", async () => {
  expect(await wireClient().account.latestRelease()).toBeNull();
});
