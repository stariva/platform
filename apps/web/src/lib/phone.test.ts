import assert from "node:assert/strict";
import { test } from "node:test";
import { phonesMatch } from "./phone";

test("phones match regardless of formatting", () => {
  assert.ok(phonesMatch("+7 977 872 25 46", "+79778722546"));
  assert.ok(phonesMatch("+7 (977) 872-25-46", "+7 977 872 25 46"));
  assert.ok(phonesMatch("8 977 872 25 46", "+79778722546"));
});

test("different or empty phones do not match", () => {
  assert.ok(!phonesMatch("+7 977 872 25 46", "+7 977 872 25 47"));
  assert.ok(!phonesMatch("", ""));
});
