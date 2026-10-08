import { describe, expect, test } from "bun:test";
import { dueReminders } from "./reminder-schedule";

const releaseAt = new Date("2026-11-01T07:00:00Z"); // 10:00 по Москве
const at = (iso: string) => new Date(iso);
const earlyBuyer = at("2026-10-08T12:00:00Z");

describe("dueReminders", () => {
  test("nothing before the week-before window", () => {
    expect(
      dueReminders({
        releaseAt,
        paidAt: earlyBuyer,
        now: at("2026-10-20T07:00:00Z"),
      }),
    ).toEqual([]);
  });

  test("week, day and release fire in their windows", () => {
    const remind = (now: string) =>
      dueReminders({ releaseAt, paidAt: earlyBuyer, now: at(now) });
    expect(remind("2026-10-25T07:00:00Z")).toEqual(["week"]);
    expect(remind("2026-10-31T07:30:00Z")).toEqual(["day"]);
    expect(remind("2026-11-01T07:00:00Z")).toEqual(["release"]);
    expect(remind("2026-11-02T20:00:00Z")).toEqual(["release"]);
  });

  test("late reminders are skipped", () => {
    // За полтора дня до старта «до старта неделя» уже не шлём
    expect(
      dueReminders({
        releaseAt,
        paidAt: earlyBuyer,
        now: at("2026-10-30T19:00:00Z"),
      }),
    ).toEqual([]);
    // Через трое суток после старта — тоже ничего
    expect(
      dueReminders({
        releaseAt,
        paidAt: earlyBuyer,
        now: at("2026-11-04T08:00:00Z"),
      }),
    ).toEqual([]);
  });

  test("a buyer gets only reminders scheduled after their purchase", () => {
    const paidAt = at("2026-10-28T10:00:00Z");
    expect(
      dueReminders({ releaseAt, paidAt, now: at("2026-10-28T11:00:00Z") }),
    ).toEqual([]);
    expect(
      dueReminders({ releaseAt, paidAt, now: at("2026-10-31T08:00:00Z") }),
    ).toEqual(["day"]);
  });

  test("buying after the start sends no reminders", () => {
    const paidAt = at("2026-11-01T09:00:00Z");
    expect(
      dueReminders({ releaseAt, paidAt, now: at("2026-11-01T10:00:00Z") }),
    ).toEqual([]);
  });
});
