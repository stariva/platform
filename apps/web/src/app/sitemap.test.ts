import { expect, test } from "bun:test";
import { ELKA_KIT_PATH } from "./nabor-elka/_data";
import sitemap from "./sitemap";

test("лендинг набора для плетения ёлки есть в sitemap", async () => {
  const entries = await sitemap();
  const kitEntry = entries.find(
    (entry) => new URL(entry.url).pathname === ELKA_KIT_PATH,
  );
  expect(kitEntry).toBeDefined();
});
