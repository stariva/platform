import { expect, mock, test } from "bun:test";

// Витрину не дёргаем: bun подхватывает .env, а там боевой адрес
const revalidateStorefront = mock(async () => true);
mock.module("../../../storefront", () => ({ revalidateStorefront }));

// Importing the router creates a pool; these tests only use the fake DB below.
const originalUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL ??=
  "postgres://postgres@localhost/workshop_lesson_video_test";
const { setLessonVideo } = await import("./set-lesson-video");
if (originalUrl === undefined) delete process.env.POSTGRES_URL;

const lessons = [
  {
    id: "l-1",
    title: "Узел",
    durationSeconds: 60,
    videoKey: "workshops/abazhur/l-1-old.mp4",
    free: true,
  },
  {
    id: "l-2",
    title: "Купол",
    durationSeconds: 90,
    videoKey: "workshops/abazhur/l-2-old.mp4",
    free: false,
  },
];

function request(
  input: { lessonId: string; videoKey: string; durationSeconds: number | null },
  row: { slug: string; lessons: typeof lessons } | undefined = {
    slug: "abazhur",
    lessons,
  },
) {
  const set = mock((_fields: { lessons: typeof lessons }) => ({
    where: async () => undefined,
  }));
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({ for: async () => (row ? [row] : []) }),
      }),
    }),
    update: () => ({ set }),
  };
  const handler = setLessonVideo["~orpc"].handler;
  const context = {
    db: { transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
  } as unknown as Parameters<typeof handler>[0]["context"];
  return {
    set,
    result: handler({
      context,
      input: { id: "ws", ...input },
      path: [],
      procedure: setLessonVideo,
      errors: {},
      lastEventId: undefined,
    }),
  };
}

test("setLessonVideo replaces only that lesson's video and duration", async () => {
  const { result, set } = request({
    lessonId: "l-2",
    videoKey: "workshops/abazhur/l-2-new.mp4",
    durationSeconds: 754,
  });
  await expect(result).resolves.toEqual({ saved: true, revalidated: true });
  expect(set.mock.calls[0]?.[0].lessons).toEqual([
    lessons[0],
    {
      ...lessons[1],
      videoKey: "workshops/abazhur/l-2-new.mp4",
      durationSeconds: 754,
    },
  ]);
});

test("setLessonVideo keeps the duration when the file had none", async () => {
  const { result, set } = request({
    lessonId: "l-1",
    videoKey: "workshops/abazhur/l-1-new.webm",
    durationSeconds: null,
  });
  await expect(result).resolves.toMatchObject({ saved: true });
  expect(set.mock.calls[0]?.[0].lessons[0]?.durationSeconds).toBe(60);
});

test("setLessonVideo leaves a lesson that is not saved yet to the form", async () => {
  const { result, set } = request({
    lessonId: "l-new",
    videoKey: "workshops/abazhur/l-new-1.mp4",
    durationSeconds: 30,
  });
  await expect(result).resolves.toEqual({ saved: false });
  expect(set).not.toHaveBeenCalled();
});

test("setLessonVideo refuses a key from another workshop", async () => {
  const { result, set } = request({
    lessonId: "l-1",
    videoKey: "workshops/other/l-1-new.mp4",
    durationSeconds: 30,
  });
  await expect(result).rejects.toThrow("Файл не из папки этого мастер-класса");
  expect(set).not.toHaveBeenCalled();
});
