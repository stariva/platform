import { PackageIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listAccountOrders } from "@/lib/account/orders";
import { getSession } from "@/lib/auth/session";
import { isOrderActive } from "@/lib/commerce/order-status";
import { cn } from "@/lib/utils";
import { OrderCard } from "./order-card";

export const dynamic = "force-dynamic";

const tabs = [
  { key: "all", label: "Все" },
  { key: "active", label: "Текущие" },
  { key: "done", label: "Завершённые" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function parseTab(value: string | string[] | undefined): TabKey {
  return tabs.find((tab) => tab.key === value)?.key ?? "all";
}

function EmptyState({
  title,
  text,
  withLinks,
}: {
  title: string;
  text: string;
  withLinks?: boolean;
}) {
  return (
    <div className="bg-white border border-espresso/10 rounded-2xl px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-sand">
        <PackageIcon className="size-6 text-espresso" aria-hidden="true" />
      </div>
      <h2 className="font-serif text-2xl text-espresso mb-2">{title}</h2>
      <p className="text-taupe text-sm max-w-sm mx-auto">{text}</p>
      {withLinks && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            asChild
            className="bg-espresso text-parchment hover:bg-espresso/90"
          >
            <Link href="/catalog">Перейти в каталог</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/workshops">Мастер-классы</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const [orders, { tab: rawTab }] = await Promise.all([
    listAccountOrders(session.user.id),
    searchParams,
  ]);

  if (orders.length === 0) {
    return (
      <EmptyState
        title="Заказов пока нет"
        text="Здесь будут ваши покупки: изделия из каталога, заказы по вашим меркам и мастер-классы."
        withLinks
      />
    );
  }

  const tab = parseTab(rawTab);
  const active = orders.filter((order) =>
    isOrderActive(order.kind, order.status),
  );
  const byTab: Record<TabKey, typeof orders> = {
    all: orders,
    active,
    done: orders.filter((order) => !active.includes(order)),
  };
  const visible = byTab[tab];
  const awaitingPayment = orders.filter((order) => order.paymentStep).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Фильтр заказов"
          className="inline-flex rounded-full bg-sand p-1"
        >
          {tabs.map((item) => {
            const selected = item.key === tab;
            return (
              <Link
                key={item.key}
                href={
                  item.key === "all"
                    ? "/account/orders"
                    : `/account/orders?tab=${item.key}`
                }
                aria-current={selected ? "page" : undefined}
                scroll={false}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-colors",
                  selected
                    ? "bg-white text-espresso shadow-sm"
                    : "text-taupe hover:text-espresso",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    selected ? "text-taupe" : "text-taupe/70",
                  )}
                >
                  {byTab[item.key].length}
                </span>
              </Link>
            );
          })}
        </nav>
        {awaitingPayment > 0 && (
          <p className="text-sm text-espresso">
            <span className="mr-2 inline-block size-1.5 rounded-full bg-espresso align-middle" />
            {awaitingPayment === 1
              ? "Один заказ ждёт оплаты"
              : `Заказов ждут оплаты: ${awaitingPayment}`}
          </p>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={tab === "active" ? "Текущих заказов нет" : "Пока пусто"}
          text={
            tab === "active"
              ? "Все заказы получены или завершены. Новые появятся здесь сразу после оформления."
              : "Здесь появятся полученные и отменённые заказы."
          }
        />
      ) : (
        <div className="space-y-4">
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
