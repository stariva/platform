import { expect, mock, test } from "bun:test";
import type { Session } from "@stariva/auth";
import type { UpsertProgressInput } from "../services/course-access";

let owned = true;
let lessons = ["lesson-1"];
let saved: UpsertProgressInput[] = [];
mock.module("../services/course-access", () => ({
  hasAccess: async () => owned,
  canWatchCourse: async () => owned,
  lessonExists: async (_slug: string, lessonId: string) =>
    lessons.includes(lessonId),
  upsertLessonProgress: async (input: UpsertProgressInput) => {
    saved.push(input);
  },
}));

type ReviewInput = import("../services/workshop-reviews").SaveWorkshopReviewInput;
type ReviewResult =
  import("../services/workshop-reviews").SaveWorkshopReviewResult;

const savedReview = {
  rating: 5,
  text: "Сплела ёлку за вечер, всё понятно",
  reviewerName: "Анна",
  photos: ["https://cdn.example.test/reviews/r-1/a.jpg"],
  status: "pending" as const,
};
let reviewResult: ReviewResult = {
  status: "ok",
  review: savedReview,
  workshopTitle: "Ёлка макраме",
  created: true,
  wasPublished: false,
};
let reviewCalls: ReviewInput[] = [];
mock.module("../services/workshop-reviews", () => ({
  getWorkshopReview: async () => null,
  saveWorkshopReview: async (input: ReviewInput) => {
    reviewCalls.push(input);
    return reviewResult;
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

test("progress is saved only for buyers of the course and admins", async () => {
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

const reviewRequest = {
  slug: "elka-makrame",
  rating: 5,
  text: "Сплела ёлку за вечер, всё понятно",
  reviewerName: "Анна",
  keepPhotos: [],
  photos: [new File([new Uint8Array([0xff, 0xd8, 0xff])], "elka.jpg", {
    type: "image/jpeg",
  })],
  publishConsent: true as const,
};
const reviewSession = {
  user: { id: "user-1", email: "anna@example.test" },
} as Session;

test("a review requires a session", async () => {
  reviewCalls = [];
  const [error] = await safe(
    wireClient().account.saveWorkshopReview(reviewRequest),
  );
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(lastStatus()).toBe(401);
  expect(reviewCalls).toEqual([]);
});

test("only a buyer of the workshop can review it", async () => {
  reviewCalls = [];
  owned = false;
  const [error] = await safe(
    wireClient({ session: reviewSession }).account.saveWorkshopReview(
      reviewRequest,
    ),
  );
  owned = true;
  expect(error).toMatchObject({ code: "FORBIDDEN" });
  expect(lastStatus()).toBe(403);
  expect(reviewCalls).toEqual([]);
});

test("a review is not accepted without consent to publish it", async () => {
  reviewCalls = [];
  const [error] = await safe(
    wireClient({ session: reviewSession }).account.saveWorkshopReview({
      ...reviewRequest,
      publishConsent: false as unknown as true,
    }),
  );
  expect(error).toMatchObject({ code: "BAD_REQUEST" });
  expect(reviewCalls).toEqual([]);
});

test("a review takes at most three photos, kept and new together", async () => {
  reviewCalls = [];
  const [error] = await safe(
    wireClient({ session: reviewSession }).account.saveWorkshopReview({
      ...reviewRequest,
      keepPhotos: ["https://cdn.example.test/1.jpg", "https://cdn.example.test/2.jpg"],
      photos: [reviewRequest.photos[0] as File, reviewRequest.photos[0] as File],
    }),
  );
  expect(error).toMatchObject({ code: "BAD_REQUEST" });
  expect(reviewCalls).toEqual([]);
});

test("buyer's review is saved with the photo and Olga is told", async () => {
  reviewCalls = [];
  const notifyWorkshopReview = mock(() => {});
  const revalidatePaths = mock((_paths: string[]) => {});
  const result = await wireClient({
    session: reviewSession,
    services: { notifyWorkshopReview, revalidatePaths },
  }).account.saveWorkshopReview(reviewRequest);

  expect(result).toEqual(savedReview);
  expect(reviewCalls).toHaveLength(1);
  const [call] = reviewCalls;
  expect(call).toMatchObject({
    userId: "user-1",
    workshopSlug: "elka-makrame",
    rating: 5,
    reviewerName: "Анна",
    keepPhotos: [],
  });
  expect(call?.photos).toHaveLength(1);
  expect(call?.photos[0]?.name).toBe("elka.jpg");
  expect(notifyWorkshopReview).toHaveBeenCalledWith({
    workshopSlug: "elka-makrame",
    workshopTitle: "Ёлка макраме",
    email: "anna@example.test",
    created: true,
    review: savedReview,
  });
  // Новый отзыв скрыт до проверки — страницы сбрасывать незачем
  expect(revalidatePaths).not.toHaveBeenCalled();
});

test("editing a published review takes it off the pages", async () => {
  reviewResult = {
    status: "ok",
    review: savedReview,
    workshopTitle: "Ёлка макраме",
    created: false,
    wasPublished: true,
  };
  const revalidatePaths = mock((_paths: string[]) => {});
  await wireClient({
    session: reviewSession,
    services: { revalidatePaths },
  }).account.saveWorkshopReview(reviewRequest);
  expect(revalidatePaths).toHaveBeenCalledWith([
    "/workshops/elka-makrame",
    "/reviews",
  ]);
});

test("review refusals become typed errors", async () => {
  const cases = [
    ["photo_invalid", "REVIEW_PHOTO_INVALID", 400],
    ["unavailable", "REVIEW_UNAVAILABLE", 503],
    ["not_found", "FORBIDDEN", 403],
  ] as const;
  for (const [status, code, http] of cases) {
    reviewResult = { status };
    const notifyWorkshopReview = mock(() => {});
    const [error] = await safe(
      wireClient({
        session: reviewSession,
        services: { notifyWorkshopReview },
      }).account.saveWorkshopReview(reviewRequest),
    );
    expect(error).toMatchObject({ code });
    expect(lastStatus()).toBe(http);
    expect(notifyWorkshopReview).not.toHaveBeenCalled();
  }
});
