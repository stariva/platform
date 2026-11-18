import { z } from "zod";

export const mobileCoursesCacheSchema = z.object({
  courses: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      cover: z.string(),
      firstLessonId: z.string().nullable().default(null),
      lessonCount: z.number().int(),
      completedLessons: z.number().int(),
    }),
  ),
  resume: z
    .object({
      slug: z.string(),
      workshopTitle: z.string(),
      lessonId: z.string(),
      lessonTitle: z.string(),
      positionSeconds: z.number(),
    })
    .nullable(),
  demo: z
    .object({
      slug: z.string(),
      workshopTitle: z.string(),
      lessonId: z.string(),
      lessonTitle: z.string(),
    })
    .nullable(),
});
