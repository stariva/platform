import { describe, expect, test } from "bun:test";
import {
  formatClock,
  formatDurationLabel,
  parseClock,
  type WorkshopFormValues,
  workshopFormSchema,
} from "./workshop";

const lesson = {
  id: "l-1",
  title: "Основа",
  durationSeconds: 600,
  videoKey: "workshops/abazhur-kupol/l-1-abc.mp4",
  free: true,
};

const valid: WorkshopFormValues = {
  title: "Абажур «Купол»",
  slug: "abazhur-kupol",
  subtitle: "",
  description: "Описание",
  category: "lampshades",
  level: "beginner",
  status: "published",
  price: 2990,
  cover: "https://cdn.stariva.ru/workshops/abazhur-kupol/a.jpg",
  previewImage: "",
  whatYouLearn: [],
  materials: [],
  lessons: [lesson],
  materialFiles: [],
  ozonUrl: "",
  featured: false,
  sortOrder: 0,
  testimonialText: "",
  testimonialAuthor: "",
};

const errorPaths = (value: WorkshopFormValues) => {
  const result = workshopFormSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
};

describe("workshopFormSchema", () => {
  test("accepts a valid published workshop", () => {
    expect(errorPaths(valid)).toEqual([]);
  });

  test("a free workshop is valid, a negative price is not", () => {
    expect(errorPaths({ ...valid, price: 0 })).toEqual([]);
    expect(errorPaths({ ...valid, price: -1 })).toEqual(["price"]);
  });

  test("prices allow whole kopecks despite floating-point rounding", () => {
    for (const price of [
      0.01,
      0.29,
      1.1,
      0.1 + 0.2,
      21_474_835.99,
      21_474_836,
    ]) {
      expect(errorPaths({ ...valid, price })).toEqual([]);
    }
  });

  test("prices reject fractional kopecks and amounts above the maximum", () => {
    for (const price of [
      0.001, 1.005, 2990.999, 21_474_835.999, 21_474_836.01,
    ]) {
      expect(errorPaths({ ...valid, price })).toEqual(["price"]);
    }
  });

  test("a draft may be incomplete", () => {
    expect(
      errorPaths({ ...valid, status: "draft", cover: "", lessons: [] }),
    ).toEqual([]);
  });

  test("publishing needs a cover, a lesson and a video for every lesson", () => {
    expect(errorPaths({ ...valid, cover: "" })).toEqual(["cover"]);
    expect(errorPaths({ ...valid, lessons: [] })).toEqual(["lessons"]);
    expect(
      errorPaths({
        ...valid,
        lessons: [{ ...lesson, videoKey: "" }],
      }),
    ).toEqual(["lessons.0.videoKey"]);
  });

  test("lesson ids must be unique", () => {
    expect(errorPaths({ ...valid, lessons: [lesson, { ...lesson }] })).toEqual([
      "lessons.1.id",
    ]);
  });

  test("covers are https links or site paths, nothing else", () => {
    expect(errorPaths({ ...valid, cover: "/images/workshops/a.jpg" })).toEqual(
      [],
    );
    expect(errorPaths({ ...valid, cover: "http://example.com/a.jpg" })).toEqual(
      ["cover"],
    );
    expect(errorPaths({ ...valid, cover: "//evil.example/a.jpg" })).toEqual([
      "cover",
    ]);
    expect(errorPaths({ ...valid, cover: "javascript:alert(1)" })).toEqual([
      "cover",
    ]);
  });

  test("testimonial needs text and author together", () => {
    expect(errorPaths({ ...valid, testimonialText: "Класс" })).toEqual([
      "testimonialAuthor",
    ]);
    expect(
      errorPaths({
        ...valid,
        testimonialText: "Класс",
        testimonialAuthor: "Анна, Казань",
      }),
    ).toEqual([]);
  });

  test("slug is lowercase latin with hyphens", () => {
    expect(errorPaths({ ...valid, slug: "Абажур" })).toEqual(["slug"]);
    expect(errorPaths({ ...valid, slug: "a--b" })).toEqual(["slug"]);
  });
});

describe("durations", () => {
  test("formatClock", () => {
    expect(formatClock(83)).toBe("1:23");
    expect(formatClock(960)).toBe("16:00");
    expect(formatClock(3725)).toBe("1:02:05");
  });

  test("parseClock accepts m:ss, h:mm:ss and bare seconds", () => {
    expect(parseClock("1:23")).toBe(83);
    expect(parseClock("1:02:05")).toBe(3725);
    expect(parseClock("90")).toBe(90);
    expect(parseClock("")).toBeNull();
    expect(parseClock("1:")).toBeNull();
    expect(parseClock("a:10")).toBeNull();
  });

  test("formatDurationLabel", () => {
    expect(formatDurationLabel(960)).toBe("16 мин");
    expect(formatDurationLabel(12_000)).toBe("3 ч 20 мин");
    expect(formatDurationLabel(7200)).toBe("2 ч");
    expect(formatDurationLabel(10)).toBe("1 мин");
  });
});
