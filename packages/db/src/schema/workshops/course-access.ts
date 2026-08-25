import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "../auth/user";
import { orders } from "./orders";

/** Доступ пользователя к мастер-классу. */
export const courseAccess = pgTable(
  "course_access",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workshopSlug: text("workshop_slug").notNull(),
    // Заказ, по которому выдан доступ (null — ручная выдача админом)
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    unique("course_access_user_workshop_uq").on(t.userId, t.workshopSlug),
  ],
);
