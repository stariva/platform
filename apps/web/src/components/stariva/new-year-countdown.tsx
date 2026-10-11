"use client";

import { useSyncExternalStore } from "react";

function daysUntilNewYear() {
  const now = new Date();
  const newYear = new Date(now.getFullYear() + 1, 0, 1);
  return Math.ceil((newYear.getTime() - now.getTime()) / 86_400_000);
}

function pluralDays(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

const subscribe = () => () => {};

/** Счётчик дней считается в браузере: страница кэшируется и не должна показывать устаревшее число. */
export function NewYearCountdown() {
  const days = useSyncExternalStore(subscribe, daysUntilNewYear, () => null);
  if (days === null) return <span className="opacity-0">00 дней</span>;
  return (
    <span className="tabular-nums">
      {days} {pluralDays(days)}
    </span>
  );
}
