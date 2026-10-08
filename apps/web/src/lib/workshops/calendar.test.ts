import { describe, expect, test } from "bun:test";
import { buildReleaseIcs, googleCalendarUrl } from "./calendar";

const event = {
  slug: "elka-makrame",
  title: "Ёлка из макраме; своими руками, с нуля",
  releaseAt: new Date("2026-11-01T07:00:00Z"),
  url: "https://stariva.ru/account/workshops/elka-makrame",
};

describe("buildReleaseIcs", () => {
  const ics = buildReleaseIcs(event);

  test("has a one-hour UTC event with CRLF line endings", () => {
    expect(ics).toContain("DTSTART:20261101T070000Z\r\n");
    expect(ics).toContain("DTEND:20261101T080000Z\r\n");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });

  test("escapes text values", () => {
    expect(ics).toContain(
      "SUMMARY:Старт мастер-класса «Ёлка из макраме\\; своими руками\\, с нуля» — Stariva",
    );
  });

  test("reminds a day and an hour before", () => {
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("TRIGGER:-PT1H");
  });
});

test("googleCalendarUrl carries the event dates", () => {
  const url = new URL(googleCalendarUrl(event));
  expect(url.searchParams.get("dates")).toBe(
    "20261101T070000Z/20261101T080000Z",
  );
  expect(url.searchParams.get("action")).toBe("TEMPLATE");
});
