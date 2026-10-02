"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  toast,
} from "@stariva/ui";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { orpc } from "~/orpc/react";

/** Имя и отметка «почта подтверждена». Адрес почты не меняем — по нему входят. */
export function UserProfileForm({
  id,
  email,
  initialName,
  initialEmailVerified,
}: {
  id: string;
  email: string;
  initialName: string;
  initialEmailVerified: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [emailVerified, setEmailVerified] = useState(initialEmailVerified);

  const trimmed = name.trim();
  const dirty =
    trimmed !== initialName || emailVerified !== initialEmailVerified;

  const save = useMutation({
    ...orpc.admin.users.update.mutationOptions(),
    onSuccess: () => {
      toast.success("Сохранено");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Не сохранилось"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Профиль</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({ id, name: trimmed, emailVerified });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="user-name">Имя</Label>
            <Input
              id="user-name"
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-email">Почта</Label>
            <Input id="user-email" value={email} readOnly disabled />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="user-verified">Почта подтверждена</Label>
            <Switch
              id="user-verified"
              checked={emailVerified}
              onCheckedChange={setEmailVerified}
            />
          </div>
          <Button
            type="submit"
            disabled={!dirty || trimmed === "" || save.isPending}
          >
            Сохранить
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
