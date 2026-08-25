import { getSession } from "@/lib/auth/session";
import { listUserOrders } from "@/lib/payments/orders";
import { formatPrice, getWorkshopBySlug } from "@/lib/workshops-data";

export const dynamic = "force-dynamic";

const statusLabels: Record<
  "pending" | "paid" | "canceled" | "refunded",
  { label: string; className: string }
> = {
  pending: { label: "Ожидает оплаты", className: "bg-linen/50 text-espresso" },
  paid: { label: "Оплачен", className: "bg-sage/25 text-sage-dark" },
  canceled: { label: "Отменён", className: "bg-espresso/8 text-taupe" },
  refunded: { label: "Возврат", className: "bg-terracotta/15 text-terracotta" },
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function AccountOrdersPage() {
  const session = await getSession();
  if (!session) return null;

  const orders = await listUserOrders(session.user.id);

  if (orders.length === 0) {
    return (
      <div className="bg-white border border-espresso/10 rounded-2xl p-10 text-center">
        <h2 className="font-serif text-2xl text-espresso mb-2">
          Заказов пока нет
        </h2>
        <p className="text-taupe text-sm">
          Здесь будет история ваших покупок мастер-классов.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-espresso/10 rounded-2xl overflow-hidden">
      {orders.map((order, i) => {
        const workshop = getWorkshopBySlug(order.workshopSlug);
        const status = statusLabels[order.status] ?? statusLabels.pending;
        return (
          <div
            key={order.id}
            className={`flex items-center justify-between gap-4 px-5 py-4 ${
              i < orders.length - 1 ? "border-b border-espresso/8" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="text-espresso text-sm font-medium truncate">
                {workshop?.title ?? order.workshopSlug}
              </p>
              <p className="text-taupe text-xs mt-0.5">
                {dateFormatter.format(order.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${status.className}`}
              >
                {status.label}
              </span>
              <span className="font-serif text-base text-espresso w-24 text-right">
                {formatPrice(order.amount / 100)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
