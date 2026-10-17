import { isAdminEmail, isAdminUser } from "@stariva/api";
import { paths } from "@stariva/config";
import { SidebarInset, SidebarProvider } from "@stariva/ui";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "~/auth/server";
import { SignOutButton } from "~/components/auth";
import { AppSidebar } from "~/components/sidebar";
import { baseEnv } from "~/env";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  // proxy.ts проверяет лишь наличие cookie: поддельная или протухшая
  // пропустит его, поэтому без живой сессии отправляем на вход здесь.
  if (!session?.user) {
    redirect(paths.auth.login);
  }
  // Войти может любой покупатель (общая база с витриной), но админка —
  // только для подтверждённых адресов из ADMIN_EMAILS
  if (!isAdminUser(session.user)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">Нет доступа</h1>
          {isAdminEmail(session.user.email) ? (
            <p className="text-muted-foreground text-sm">
              Почта {session.user.email} не подтверждена. Выйдите и войдите по
              коду из письма — это подтвердит адрес.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Аккаунт {session.user.email} не входит в список администраторов
              Stariva. Войдите под другим адресом или попросите добавить этот.
            </p>
          )}
          <SignOutButton />
        </div>
      </main>
    );
  }
  return (
    <SidebarProvider>
      <AppSidebar
        storefrontUrl={baseEnv.STOREFRONT_URL}
        user={{
          name: session.user.name,
          email: session.user.email,
          avatar: session.user.image || "",
        }}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
