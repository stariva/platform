"use client";

import { paths } from "@stariva/config";
import { Button } from "@stariva/ui";
import { useRouter } from "next/navigation";

import { authClient } from "~/auth/client";

/** Выход из аккаунта — для экрана «Нет доступа», где нет меню пользователя. */
export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      variant="outline"
      onClick={async () => {
        await authClient.signOut();
        router.push(paths.auth.login);
      }}
    >
      Выйти
    </Button>
  );
}
