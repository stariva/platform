import { isAdminEmail } from "@stariva/api";
import { SidebarInset, SidebarProvider } from "@stariva/ui";
import type { ReactNode } from "react";
import { getSession } from "~/auth/server";
import { AppSidebar } from "~/components/sidebar";
import { baseEnv } from "~/env";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) {
    return <>{children}</>;
  }
  // Войти может кто угодно, но админка — только для ADMIN_EMAILS
  if (!isAdminEmail(session.user.email)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm space-y-2 text-center">
          <h1 className="text-xl font-semibold">Нет доступа</h1>
          <p className="text-muted-foreground text-sm">
            Аккаунт {session.user.email} не входит в список администраторов
            Stariva. Войдите под другим адресом или попросите добавить этот.
          </p>
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
