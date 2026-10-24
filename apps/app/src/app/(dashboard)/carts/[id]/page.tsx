import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import { Badge } from "@stariva/ui/reui";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ACTION_LABELS,
  cartTotal,
  optionsLabel,
  visitorSummary,
} from "~/components/carts/cart-meta";
import { SiteHeader } from "~/components/layout";
import {
  dateTime,
  KIND_LABELS,
  productSiteUrl,
  rubles,
  STATUS_LABELS,
  statusVariant,
} from "~/components/orders/order-meta";
import { VisitorCard } from "~/components/visitors/visitor-card";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

/** «2 → 3», «было 2», а у новой строки — просто количество. */
function quantityChange(before: number, after: number) {
  if (before === 0) return `× ${after}`;
  if (after === 0) return `было ${before}`;
  return `${before} → ${after}`;
}

export default async function CartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cart = await api.admin.carts.byId({ id }).catch((error) => {
    if ((error as { code?: string }).code === "NOT_FOUND") notFound();
    throw error;
  });
  const total = cartTotal(cart.items);
  const guest = visitorSummary(cart.visitor);

  return (
    <>
      <SiteHeader title="Корзины" />
      <div className="max-w-4xl space-y-4 px-4 pb-10 lg:px-6">
        <div>
          <Link
            href="/carts"
            className="text-muted-foreground text-sm hover:underline"
          >
            ← Все корзины
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Корзина
          </h1>
          <p className="text-muted-foreground text-sm">
            {cart.users.length > 0
              ? cart.users.map((person, index) => (
                  <span key={person.id}>
                    {index > 0 && ", "}
                    <Link
                      href={`/users/${person.id}`}
                      className="hover:underline"
                    >
                      {person.name} · {person.email}
                    </Link>
                  </span>
                ))
              : "Гость без входа в кабинет"}
            {guest && ` · ${guest}`} · с {dateTime.format(cart.firstAt)} по{" "}
            {dateTime.format(cart.lastAt)}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              В корзине сейчас
              {total > 0 && ` · ${rubles.format(total / 100)}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cart.items.length === 0 ? (
              <p className="text-muted-foreground text-sm">Пусто</p>
            ) : (
              <ul className="space-y-3">
                {cart.items.map((item) => (
                  <li
                    key={`${item.fulfillmentType}:${item.productSlug}:${optionsLabel(item.options) ?? ""}`}
                    className="flex items-center gap-3 text-sm"
                  >
                    {item.image ? (
                      // biome-ignore lint/performance/noImgElement: превью с CDN витрины, оптимизация Next не нужна
                      <img
                        src={item.image}
                        alt=""
                        className="size-12 rounded object-cover"
                      />
                    ) : (
                      <div className="bg-muted size-12 rounded" />
                    )}
                    <div className="flex-1">
                      <a
                        href={productSiteUrl(item.productSlug)}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {item.name}
                      </a>
                      <div className="text-muted-foreground text-xs">
                        {item.fulfillmentType === "made_to_order"
                          ? `Под заказ${item.options ? `: ${optionsLabel(item.options)}` : ""}`
                          : "Готовое"}
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      {item.quantity} × {rubles.format(item.price / 100)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {cart.orders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Оформленные заказы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {cart.orders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center gap-2"
                >
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-medium hover:underline"
                  >
                    №{order.number}
                  </Link>
                  <Badge variant={statusVariant(order.status)}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </Badge>
                  <span className="text-muted-foreground">
                    {KIND_LABELS[order.kind]} ·{" "}
                    {rubles.format(order.amountTotal / 100)} ·{" "}
                    {order.contactName}, {order.contactPhone}
                    {order.contactEmail && `, ${order.contactEmail}`}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              История{cart.truncated && " (последние 500 событий)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Когда</TableHead>
                  <TableHead>Что</TableHead>
                  <TableHead>Откуда</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-muted-foreground align-top text-sm whitespace-nowrap">
                      {dateTime.format(event.createdAt)}
                    </TableCell>
                    <TableCell className="align-top text-sm whitespace-normal">
                      <div className="font-medium">
                        {ACTION_LABELS[event.action]}
                        {event.orderId && event.orderNumber !== null && (
                          <>
                            {" "}
                            <Link
                              href={`/orders/${event.orderId}`}
                              className="hover:underline"
                            >
                              заказ №{event.orderNumber}
                            </Link>
                          </>
                        )}
                      </div>
                      <ul className="text-muted-foreground">
                        {event.changes.map((change) => (
                          <li
                            key={`${change.fulfillmentType}:${change.productSlug}:${optionsLabel(change.options) ?? ""}`}
                          >
                            {change.name}
                            {change.options &&
                              ` (${optionsLabel(change.options)})`}{" "}
                            · {quantityChange(change.before, change.after)}
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top text-xs">
                      {event.visitor?.page}
                      <div>{event.ip}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <VisitorCard visitor={cart.visitor} />
      </div>
    </>
  );
}
