import { bookingSchema, type Booking } from "@/api/schemas";

const sample = bookingSchema.parse({
  id: "demo-booking",
  workshopId: "tree",
  title: "Плетёная ёлка",
  image: "/images/workshop-tree.png",
  host: "Мастер Stariva",
  startsAt: "2026-12-03T12:00:00.000Z",
  endsAt: "2026-12-03T15:00:00.000Z",
  address: "Демонстрационный адрес, Москва",
  seats: 1,
  status: "confirmed",
  whatToBring: ["Хорошее настроение", "Удобную одежду"],
  organizerEmail: "hello@stariva.ru",
  cancellationPolicy: "Условия отмены будут указаны в подтверждённой записи.",
  ticketCode: "ДЕМО · БИЛЕТ НЕДЕЙСТВИТЕЛЕН",
});

/** API очных записей ещё нет. Демо доступно только с ?demo-bookings=1 в dev. */
export const mockBookings = {
  list: async (): Promise<Booking[]> =>
    import.meta.env.DEV &&
    new URLSearchParams(location.search).has("demo-bookings")
      ? [sample]
      : [],
};
