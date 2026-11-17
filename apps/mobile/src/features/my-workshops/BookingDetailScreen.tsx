import { ArrowLeft, CalendarPlus, MapPin, Share2, Ticket } from "lucide-react";
import type { Booking } from "@/api/schemas";
import { Badge, Button } from "@/components/ui/Primitives";
import { native } from "@/lib/native";

export function BookingDetailScreen({
  booking,
  onBack,
}: {
  booking: Booking;
  onBack: () => void;
}) {
  const date = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(booking.startsAt));
  return (
    <main className="min-h-dvh bg-bg pb-24 text-fg">
      <div className="relative">
        <img
          src={booking.image}
          alt=""
          className="aspect-[4/3] w-full object-cover"
        />
        <button
          type="button"
          aria-label="Назад"
          onClick={onBack}
          className="glass absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))] flex size-12 items-center justify-center rounded-full"
        >
          <ArrowLeft />
        </button>
      </div>
      <div className="relative -mt-6 rounded-t-[var(--radius-xl)] bg-bg px-5 pt-7">
        <Badge>Демонстрационная запись</Badge>
        <h1 className="display mt-4">{booking.title}</h1>
        <p className="mt-4 text-sm">{date}</p>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <MapPin size={18} />
          {booking.address}
        </p>
        <p className="mt-2 text-sm text-muted">
          Мастер: {booking.host} · {booking.seats} место
        </p>
        <div className="mt-7 rounded-[var(--radius-xl)] bg-surface p-6 text-center shadow-[var(--shadow-1)]">
          <Ticket className="mx-auto text-accent" size={32} />
          <h2 className="section-title mt-3">Билет</h2>
          <p className="mt-2 text-sm text-muted">{booking.ticketCode}</p>
          <p className="mt-3 text-xs text-muted">
            QR-код будет доступен после подключения серверных билетов. Этот
            билет недействителен.
          </p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <a
            href={native.calendarUrl(
              booking.title,
              booking.startsAt,
              booking.endsAt,
              booking.address,
            )}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-surface px-2 text-center text-xs font-semibold ring-1 ring-line"
          >
            <CalendarPlus size={18} />В календарь
          </a>
          <a
            href={`https://yandex.ru/maps/?text=${encodeURIComponent(booking.address)}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-surface px-2 text-center text-xs font-semibold ring-1 ring-line"
          >
            <MapPin size={18} />
            Маршрут
          </a>
        </div>
        <section className="mt-9">
          <h2 className="section-title">Что взять с собой</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-muted">
            {booking.whatToBring.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="mt-9">
          <h2 className="section-title">Организатор</h2>
          <a
            href={`mailto:${booking.organizerEmail}`}
            className="mt-3 block min-h-11 text-sm text-accent underline"
          >
            {booking.organizerEmail}
          </a>
          <p className="mt-2 text-sm text-muted">
            {booking.cancellationPolicy}
          </p>
        </section>
        <Button
          variant="secondary"
          className="mt-5 w-full"
          onClick={() =>
            void native.share(booking.title, location.href).catch(() => {})
          }
        >
          <Share2 size={18} />
          Поделиться
        </Button>
        <p className="mt-5 text-center text-xs text-muted">
          Перенос и отмена появятся после подключения API записей.
        </p>
      </div>
    </main>
  );
}
