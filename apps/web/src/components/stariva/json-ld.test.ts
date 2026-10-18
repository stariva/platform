import { expect, test } from "bun:test";
import { toJsonLd } from "./json-ld";

test("a review cannot close the JSON-LD script tag", () => {
  const json = toJsonLd({
    reviewBody: "Отлично!</script><script>alert(1)</script>",
  });
  expect(json).not.toContain("</script");
  expect(json).not.toContain("<");
  // Для поисковика это тот же текст
  expect(JSON.parse(json).reviewBody).toBe(
    "Отлично!</script><script>alert(1)</script>",
  );
});
