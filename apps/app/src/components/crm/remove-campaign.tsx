"use client";

import { Button, toast } from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";

/** Удаляет кампанию вместе с её расходами. */
export function RemoveCampaign({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const remove = useMutation({
    ...orpc.admin.crm.removeCampaign.mutationOptions(),
    onSuccess: () => {
      toast.success("Кампания удалена");
      router.replace("/crm/campaigns");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалилось"),
  });

  return (
    <Button
      variant="destructive"
      className="w-full"
      disabled={remove.isPending}
      onClick={async () => {
        if (
          await confirm({
            title: `Удалить кампанию «${name}»?`,
            description:
              "Удалятся все её расходы. Клиенты с сайта останутся с голой меткой, а у отмеченных вручную источник станет «Не с рекламы». Если кампания просто закончилась, лучше отметьте её как законченную.",
            confirmLabel: "Удалить",
            destructive: true,
          })
        ) {
          remove.mutate({ id });
        }
      }}
    >
      {remove.isPending ? "Удаляем…" : "Удалить кампанию"}
    </Button>
  );
}
