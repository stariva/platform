"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  toast,
} from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { orpc } from "~/orpc/react";

/** Выход со всех устройств и удаление аккаунта. */
export function UserDangerZone({
  id,
  name,
  sessionsCount,
  isAdmin,
}: {
  id: string;
  name: string;
  sessionsCount: number;
  isAdmin: boolean;
}) {
  const router = useRouter();

  const revokeSessions = useMutation({
    ...orpc.admin.users.revokeSessions.mutationOptions(),
    onSuccess: ({ revoked }) => {
      toast.success(
        revoked > 0 ? "Пользователь вышел со всех устройств" : "Сессий не было",
      );
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не получилось"),
  });

  const remove = useMutation({
    ...orpc.admin.users.remove.mutationOptions(),
    onSuccess: () => {
      toast.success("Пользователь удалён");
      router.replace("/users");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалилось"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Опасная зона</CardTitle>
        <CardDescription>
          Сессий сейчас: {sessionsCount}. Удалить можно только аккаунт без
          оплаченных заказов на мастер-классы и не из списка администраторов.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={sessionsCount === 0 || revokeSessions.isPending}
          onClick={() => {
            if (
              window.confirm(
                `Завершить все сессии пользователя ${name}? Ему придётся войти заново.`,
              )
            ) {
              revokeSessions.mutate({ id });
            }
          }}
        >
          Завершить все сессии
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={isAdmin || remove.isPending}
          onClick={() => {
            if (
              window.confirm(
                `Удалить пользователя ${name}? Его доступы, прогресс и сертификаты пропадут, это нельзя отменить.`,
              )
            ) {
              remove.mutate({ id });
            }
          }}
        >
          Удалить пользователя
        </Button>
      </CardContent>
    </Card>
  );
}
