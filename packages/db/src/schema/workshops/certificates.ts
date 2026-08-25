import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "../auth/user";

/** Сертификат о прохождении мастер-класса. */
export const certificates = pgTable(
  "certificates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workshopSlug: text("workshop_slug").notNull(),
    // Человекочитаемый номер сертификата
    number: text("number").notNull().unique(),
    issuedAt: timestamp("issued_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [unique("certificates_user_workshop_uq").on(t.userId, t.workshopSlug)],
);
