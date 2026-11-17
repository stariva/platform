import { z } from "zod";

export const mobileCoursesCacheSchema = z.object({
  courses: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      cover: z.string(),
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

export const bookingSchema = z.object({
  id: z.string(),
  workshopId: z.string(),
  title: z.string(),
  image: z.string(),
  host: z.string(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  address: z.string(),
  seats: z.number().int().positive(),
  status: z.enum(["confirmed", "pending_payment", "cancelled", "completed"]),
  whatToBring: z.array(z.string()),
  organizerEmail: z.email(),
  cancellationPolicy: z.string(),
  ticketCode: z.string().nullable(),
});
export type Booking = z.infer<typeof bookingSchema>;
