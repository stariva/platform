"use client";

import { Button, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { orpc } from "~/orpc/react";

/** Убирает заявку без заказа из «Новых» на доске заказов или возвращает её. */
export function ArchiveRequest({
  number,
  archived,
}: {
  number: number;
  archived: boolean;
}) {
  const router = useRouter();
  const archive = useMutation({
    ...orpc.admin.requests.archive.mutationOptions(),
    onSuccess: ({ archivedAt }) => {
      toast.success(archivedAt ? "Заявка в архиве" : "Заявка снова в работе");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={archive.isPending}
      onClick={() => archive.mutate({ number, archived: !archived })}
    >
      {archived ? "Вернуть в работу" : "В архив — заказа не будет"}
    </Button>
  );
}
