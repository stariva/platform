import type { CartEventItem, VisitorInfo } from "@stariva/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stariva/ui";
import { Badge } from "@stariva/ui/reui";
import Link from "next/link";
import {
  dateTime,
  rubles,
  STATUS_LABELS,
  statusVariant,
} from "~/components/orders/order-meta";
import { cartTotal, optionsLabel, visitorSummary } from "./cart-meta";

export interface CartRow {
  cartId: string;
  lastAt: Date;
  eventsCount: number;
  items: CartEventItem[];
  visitor: VisitorInfo | null;
  ordersCount: number;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  orderId: string | null;
  orderNumber: number | null;
  orderStatus: string | null;
  contactName: string | null;
  contactPhone: string | null;
}

/** До трёх строк состава, остальное — «ещё N». */
const SHOWN_ITEMS = 3;

/** Таблица корзин: что лежит сейчас, кто это и чем кончилось. */
export function CartsTable({ rows }: { rows: CartRow[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>В корзине сейчас</TableHead>
            <TableHead>Кто</TableHead>
            <TableHead>Заказ</TableHead>
            <TableHead>Последнее действие</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground py-8 text-center"
              >
                Корзин нет
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => {
            const total = cartTotal(row.items);
            const rest = row.items.length - SHOWN_ITEMS;
            return (
              <TableRow key={row.cartId}>
                <TableCell className="max-w-[420px] whitespace-normal">
                  <Link
                    href={`/carts/${row.cartId}`}
                    className="block text-sm hover:underline"
                  >
                    {row.items.length === 0 ? (
                      <span className="text-muted-foreground">Пусто</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {row.items.slice(0, SHOWN_ITEMS).map((item) => (
                          <li
                            key={`${item.fulfillmentType}:${item.productSlug}:${optionsLabel(item.options) ?? ""}`}
                          >
                            {item.name}
                            {item.quantity > 1 && ` × ${item.quantity}`}
                            {item.options && (
                              <span className="text-muted-foreground">
                                {" "}
                                · под заказ, {optionsLabel(item.options)}
                              </span>
                            )}
                          </li>
                        ))}
                        {rest > 0 && (
                          <li className="text-muted-foreground">ещё {rest}</li>
                        )}
                      </ul>
                    )}
                  </Link>
                  {total > 0 && (
                    <div className="text-muted-foreground text-xs tabular-nums">
                      {rubles.format(total / 100)} · событий: {row.eventsCount}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {row.userId ? (
                    <Link
                      href={`/users/${row.userId}`}
                      className="hover:underline"
                    >
                      {row.userName}
                      <div className="text-muted-foreground text-xs">
                        {row.userEmail}
                      </div>
                    </Link>
                  ) : row.contactName ? (
                    <>
                      {row.contactName}
                      <div className="text-muted-foreground text-xs">
                        {row.contactPhone}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Гость</span>
                  )}
                  {visitorSummary(row.visitor) && (
                    <div className="text-muted-foreground text-xs">
                      {visitorSummary(row.visitor)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {row.orderId && row.orderNumber !== null ? (
                    <div className="flex flex-col items-start gap-1">
                      <Link
                        href={`/orders/${row.orderId}`}
                        className="hover:underline"
                      >
                        №{row.orderNumber}
                        {row.ordersCount > 1 && ` и ещё ${row.ordersCount - 1}`}
                      </Link>
                      {row.orderStatus && (
                        <Badge variant={statusVariant(row.orderStatus)}>
                          {STATUS_LABELS[row.orderStatus] ?? row.orderStatus}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {dateTime.format(row.lastAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
