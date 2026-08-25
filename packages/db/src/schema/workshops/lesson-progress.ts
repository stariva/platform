import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "../auth/user";

/** Прогресс просмотра конкретного урока. */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workshopSlug: text("workshop_slug").notNull(),
    lessonId: text("lesson_id").notNull(),
    // Текущая позиция и длительность в секундах — для «продолжить с места»
    positionSeconds: integer("position_seconds").notNull().default(0),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [unique("lesson_progress_user_lesson_uq").on(t.userId, t.lessonId)],
);
