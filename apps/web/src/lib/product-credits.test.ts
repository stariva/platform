import { describe, expect, it } from "vitest";
import { getIdeaCredit } from "./product-credits";

describe("getIdeaCredit", () => {
  it("указывает автора идеи у гномов", () => {
    expect(
      getIdeaCredit({ name: "Гном Тыква — осенний декор для дома, 40–45 см" }),
    ).toBe("Автор идеи — Марина Камбур.");
    expect(
      getIdeaCredit({ name: "Гном Мухомор — осенний декор для дома" }),
    ).toBe("Автор идеи — Марина Камбур.");
  });

  it("не трогает остальные изделия", () => {
    expect(getIdeaCredit({ name: "Ёлка макраме большая" })).toBeNull();
  });
});
