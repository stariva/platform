import {
  Badge,
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
import { notFound } from "next/navigation";
import { SiteHeader } from "~/components/layout";
import { UserAccess } from "~/components/users/user-access";
import { UserAvatar } from "~/components/users/user-avatar";
import { UserDangerZone } from "~/components/users/user-danger-zone";
import { UserProfileForm } from "~/components/users/user-profile-form";
import { api } from "~/orpc/server";

export const dynamic = "force-dynamic";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  canceled: "Отменён",
  refunded: "Возврат",
  ozon_order_failed: "Ошибка Ozon",
  fulfilling: "Собирается",
  shipped: "В доставке",
  delivered: "Получен",
};

function OrdersTable({
  title,
  rows,
}: {
  title: string;
  rows: {
    id: string;
    label: string;
    amount: number;
    status: string;
    createdAt: Date;
  }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Заказ</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-muted-foreground py-6 text-center"
                  >
                    Заказов нет
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[320px] whitespace-normal">
                    <div className="text-sm">{row.label}</div>
                    <div className="text-muted-foreground font-mono text-xs">
                      {row.id}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {dateFormat.format(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.status === "paid" ? "default" : "secondary"}
                    >
                      {STATUS_LABELS[row.status] ?? row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {rub.format(row.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, workshops] = await Promise.all([
    api.admin.users.byId({ id }).catch((error) => {
      if ((error as { code?: string }).code === "NOT_FOUND") notFound();
      throw error;
    }),
    api.admin.workshops.list(),
  ]);

  return (
    <>
      <SiteHeader title={user.name} />
      <div className="space-y-4 px-4 pb-10 lg:px-6">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={user.name}
            image={user.image}
            className="size-14 text-lg"
          />
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {user.name}
              {user.isAdmin && <Badge>Админ</Badge>}
            </h1>
            <p className="text-muted-foreground text-sm">
              {user.email}
              {user.username && ` · @${user.username}`} · регистрация{" "}
              {dateFormat.format(user.createdAt)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* key: после сохранения форма берёт свежие данные с сервера */}
          <UserProfileForm
            key={user.updatedAt.toISOString()}
            id={user.id}
            email={user.email}
            initialName={user.name}
            initialEmailVerified={user.emailVerified}
          />
          <UserAccess
            userId={user.id}
            access={user.access.map((row) => ({
              ...row,
              grantedAt: row.grantedAt.toISOString(),
            }))}
            workshops={workshops.map(({ slug, title }) => ({ slug, title }))}
          />
        </div>

        <OrdersTable
          title="Заказы на мастер-классы"
          rows={user.workshopOrders.map((order) => ({
            id: order.id,
            label: order.workshopTitle ?? order.workshopSlug,
            amount: order.amount,
            status: order.status,
            createdAt: order.createdAt,
          }))}
        />
        <OrdersTable
          title="Заказы на товары"
          rows={user.productOrders.map((order) => ({
            id: order.id,
            label: "Заказ из каталога",
            amount: order.amountTotal,
            status: order.status,
            createdAt: order.createdAt,
          }))}
        />

        <UserDangerZone
          id={user.id}
          name={user.name}
          sessionsCount={user.sessionsCount}
          isAdmin={user.isAdmin}
        />
      </div>
    </>
  );
}
