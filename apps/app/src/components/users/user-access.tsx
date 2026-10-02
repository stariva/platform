"use client";

import {
  Badge,
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
import { useState } from "react";
import { orpc } from "~/orpc/react";

export interface UserAccessRow {
  id: string;
  workshopSlug: string;
  workshopTitle: string | null;
  /** null — доступ выдан вручную */
  orderId: string | null;
  grantedAt: string;
}

export interface WorkshopOption {
  slug: string;
  title: string;
}

const selectClass =
  "border-input bg-background h-9 min-w-0 flex-1 rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });

/** Мастер-классы, к которым у пользователя есть доступ, с выдачей и отзывом. */
export function UserAccess({
  userId,
  access,
  workshops,
}: {
  userId: string;
  access: UserAccessRow[];
  workshops: WorkshopOption[];
}) {
  const router = useRouter();
  const [slug, setSlug] = useState("");

  const granted = new Set(access.map((row) => row.workshopSlug));
  const available = workshops.filter((workshop) => !granted.has(workshop.slug));

  const grant = useMutation({
    ...orpc.admin.users.grantAccess.mutationOptions(),
    onSuccess: () => {
      toast.success("Доступ выдан");
      setSlug("");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не получилось"),
  });

  const revoke = useMutation({
    ...orpc.admin.users.revokeAccess.mutationOptions(),
    onSuccess: () => {
      toast.success("Доступ закрыт");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не получилось"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Мастер-классы</CardTitle>
        <CardDescription>
          Прогресс просмотра и сертификат при закрытии доступа сохраняются.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {access.length === 0 ? (
          <p className="text-muted-foreground text-sm">Доступов пока нет</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {access.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {row.workshopTitle ?? row.workshopSlug}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    с {dateFormat.format(new Date(row.grantedAt))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={row.orderId ? "default" : "secondary"}>
                    {row.orderId ? "по заказу" : "вручную"}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={revoke.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Закрыть доступ к «${row.workshopTitle ?? row.workshopSlug}»?`,
                        )
                      ) {
                        revoke.mutate({ accessId: row.id });
                      }
                    }}
                  >
                    Закрыть
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {available.length > 0 && (
          <div className="flex gap-2">
            <select
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              aria-label="Мастер-класс для выдачи доступа"
              className={selectClass}
            >
              <option value="">Выберите мастер-класс…</option>
              {available.map((workshop) => (
                <option key={workshop.slug} value={workshop.slug}>
                  {workshop.title}
                </option>
              ))}
            </select>
            <Button
              type="button"
              disabled={slug === "" || grant.isPending}
              onClick={() => grant.mutate({ userId, workshopSlug: slug })}
            >
              Выдать доступ
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
