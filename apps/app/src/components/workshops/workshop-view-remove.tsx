"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@stariva/ui";
import { IconDots, IconTrash } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useConfirm } from "~/components/confirm-dialog";
import { orpc } from "~/orpc/react";

/** Удаляет просмотр из журнала: одну строку или все просмотры зрителя. */
export function WorkshopViewRemove({
  viewer,
  who,
  lesson,
}: {
  /** Ключ зрителя из admin.workshops.views. */
  viewer: string;
  /** Имя или «гость с IP …» — для подтверждения. */
  who: string;
  lesson: {
    workshopSlug: string;
    lessonId: string;
    day: string;
    /** Урок и дата — для подтверждения. */
    label: string;
  };
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const remove = useMutation({
    ...orpc.admin.workshops.removeViews.mutationOptions(),
    onSuccess: () => {
      toast.success("Просмотры удалены");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не удалилось"),
  });

  async function removeLesson() {
    const confirmed = await confirm({
      title: `Удалить просмотр: ${who}?`,
      description: (
        <p>
          {lesson.label}. Прогресс в плеере останется. Это нельзя отменить.
        </p>
      ),
      confirmLabel: "Удалить",
      destructive: true,
    });
    if (!confirmed) return;
    const { label: _, ...key } = lesson;
    remove.mutate({ viewer, lesson: key });
  }

  async function removeAll() {
    const confirmed = await confirm({
      title: `Удалить все просмотры: ${who}?`,
      description: (
        <p>
          Пропадут просмотры всех уроков всех курсов за всё время. Прогресс в
          плеере останется. Это нельзя отменить.
        </p>
      ),
      confirmLabel: "Удалить все",
      destructive: true,
    });
    if (confirmed) remove.mutate({ viewer });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={remove.isPending}
            aria-label="Действия с просмотром"
          />
        }
      >
        <IconDots />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem variant="destructive" onClick={removeLesson}>
          <IconTrash />
          <span>Удалить эту строку</span>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={removeAll}>
          <IconTrash />
          <span>Удалить все просмотры зрителя</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
