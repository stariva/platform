import assert from "node:assert/strict";
import { test } from "node:test";
import { formatWorkshopReviewMessage } from "./review-message";

const notice = {
  workshopSlug: "elka-makrame",
  workshopTitle: "Ёлка макраме",
  email: "anna@example.test",
  created: true,
  review: {
    rating: 4,
    text: "Сплела за вечер",
    reviewerName: "Анна",
    photos: ["https://cdn.example.test/a.jpg"],
    status: "pending" as const,
  },
};

test("a new review tells Olga who wrote it and what to do", () => {
  const { title, message } = formatWorkshopReviewMessage(notice);
  assert.equal(title, "Новый отзыв о мастер-классе «Ёлка макраме»");
  assert.match(message, /★★★★☆ · Анна · фото: 1/);
  assert.match(message, /Email: anna@example\.test/);
  assert.match(message, /Сплела за вечер/);
  assert.match(message, /в админке/);
});

test("an edited review is marked as changed", () => {
  const { title, message } = formatWorkshopReviewMessage({
    ...notice,
    created: false,
    review: { ...notice.review, photos: [] },
  });
  assert.equal(title, "Изменён отзыв о мастер-классе «Ёлка макраме»");
  assert.match(message, /без фото/);
});
