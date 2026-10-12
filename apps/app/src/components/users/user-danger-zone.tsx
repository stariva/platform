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
import { useConfirm } from "~/components/confirm-dialog";
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
  const confirm = useConfirm();

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
          onClick={async () => {
            if (
              await confirm({
                title: `Завершить все сессии пользователя ${name}?`,
                description: "Ему придётся войти заново.",
                confirmLabel: "Завершить",
              })
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
          onClick={async () => {
            if (
              await confirm({
                title: `Удалить пользователя ${name}?`,
                description:
                  "Его доступы, прогресс и сертификаты пропадут, это нельзя отменить.",
                confirmLabel: "Удалить",
                destructive: true,
              })
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
