/** «1 оценка», «3 оценки», «30 оценок» */
export function pluralRatings(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "оценка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "оценки";
  return "оценок";
}

/** 4.933 → «4,9» */
export function formatRating(value: number) {
  return value.toFixed(1).replace(".", ",");
}
