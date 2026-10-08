/** Почтовые домены, в которых чаще всего ошибаются наши покупатели. */
const KNOWN_DOMAINS = [
  "mail.ru",
  "yandex.ru",
  "gmail.com",
  "bk.ru",
  "list.ru",
  "inbox.ru",
  "ya.ru",
  "rambler.ru",
  "icloud.com",
  "outlook.com",
  "hotmail.com",
];

/** Опечатки, которые не ловятся расстоянием: «gmail.ru» ближе к mail.ru. */
const EXPLICIT: Record<string, string> = {
  "gmail.ru": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "yandex.com": "yandex.ru",
  "yandeks.ru": "yandex.ru",
  "mail.ry": "mail.ru",
  "mail.ri": "mail.ru",
  "mail.com": "mail.ru",
};

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] ?? 0;
      row[j] = Math.min(
        above + 1,
        (row[j - 1] ?? 0) + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return row[b.length] ?? 0;
}

/**
 * «olga@gmial.com» → «olga@gmail.com». null — ошибки не видно. Только
 * подсказка: покупатель сам решает, исправлять ли адрес.
 */
export function suggestEmailFix(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0) return null;
  const local = email.slice(0, at);
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  if (!domain || KNOWN_DOMAINS.includes(domain)) return null;

  const explicit = EXPLICIT[domain];
  if (explicit) return `${local}@${explicit}`;

  // Короткие домены вроде bk.ru сами по себе близки ко многим — не гадаем
  if (domain.length < 6) return null;
  const nearest = KNOWN_DOMAINS.filter((known) => known.length >= 6).find(
    (known) => distance(domain, known) <= (known.length > 8 ? 2 : 1),
  );
  return nearest ? `${local}@${nearest}` : null;
}
