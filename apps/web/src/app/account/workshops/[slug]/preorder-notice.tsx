import { CalendarPlus, Check, Lock } from "lucide-react";
import { workshopCalendarLinks } from "@/lib/workshops/notifications";
import {
  formatReleaseDateTime,
  getWorkshopLessons,
  type Workshop,
} from "@/lib/workshops-data";

const DAY = 24 * 3600 * 1000;

function daysLeftLabel(releaseAt: Date, now = new Date()): string {
  const days = Math.ceil((releaseAt.getTime() - now.getTime()) / DAY);
  if (days <= 1) return "Старт меньше чем через сутки";
  const mod10 = days % 10;
  const mod100 = days % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? "день"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "дня"
        : "дней";
  return `До старта ${days} ${word}`;
}

const button =
  "flex items-center justify-center gap-2 rounded-xl border border-espresso/15 bg-white px-4 py-3 text-sm text-espresso transition-colors hover:bg-sand/60";

/** Кабинет предзаказа: уроки ещё закрыты, показываем дату и подготовку. */
export function PreorderNotice({
  workshop,
  releaseAt,
}: {
  workshop: Workshop;
  releaseAt: string;
}) {
  const start = new Date(releaseAt);
  const calendar = workshopCalendarLinks({
    slug: workshop.slug,
    title: workshop.title,
    releaseAt: start,
  });
  const lessons = getWorkshopLessons(workshop);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-sage-pale p-6">
        <p className="label-caps mb-2 text-[11px] text-taupe">
          {daysLeftLabel(start)}
        </p>
        <h3 className="mb-2 font-serif text-2xl text-espresso">
          Уроки откроются {formatReleaseDateTime(releaseAt)}
        </h3>
        <p className="mb-5 text-sm leading-relaxed text-dark-grey">
          Место за вами. Напомним письмом за неделю, за день и в момент старта,
          а уроки появятся прямо здесь.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <a href={calendar.icsUrl} className={button}>
            <CalendarPlus className="size-4" aria-hidden />В календарь телефона
          </a>
          <a
            href={calendar.googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={button}
          >
            <CalendarPlus className="size-4" aria-hidden />
            Google Календарь
          </a>
        </div>
      </section>

      {workshop.materials.length > 0 && (
        <section className="rounded-2xl border border-espresso/10 bg-white p-6">
          <h3 className="mb-3 font-serif text-xl text-espresso">
            Что подготовить к старту
          </h3>
          <ul className="flex flex-col gap-2">
            {workshop.materials.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-sm text-espresso"
              >
                <Check
                  className="mt-0.5 size-4 shrink-0 text-sage"
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {lessons.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-espresso/10 bg-white">
          <h3 className="border-b border-espresso/8 px-5 py-4 font-serif text-lg text-espresso">
            Программа
          </h3>
          <ol>
            {lessons.map((lesson, i) => (
              <li
                key={lesson.id}
                className={`flex items-center gap-4 px-5 py-4 ${
                  i < lessons.length - 1 ? "border-b border-espresso/8" : ""
                }`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-espresso/6 text-xs text-taupe">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm text-espresso">
                  {lesson.title}
                </span>
                <Lock
                  className="size-4 text-taupe"
                  aria-label="Откроется в день старта"
                />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
