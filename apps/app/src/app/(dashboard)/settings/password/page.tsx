import { PasswordForm } from "~/components/settings/password-form";
import { SettingsSidebar } from "~/components/settings/settings-sidebar";

export const dynamic = "force-dynamic";

export default function SettingsPasswordPage() {
  return (
    <div className="space-y-6 p-10 pb-16 max-w-5xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
        <p className="text-muted-foreground">
          Управление аккаунтом и параметрами уведомлений.
        </p>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-[240px] shrink-0">
          <div className="rounded-lg border p-2">
            <SettingsSidebar />
          </div>
        </aside>
        <div className="flex-1">
          <div className="rounded-lg border p-6">
            <PasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
