import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { getSession } from "@/lib/auth/session";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const session = await getSession();
  if (!session) return null;
  // Входившим только по коду пароль задают с нуля, без «текущего пароля»
  const accounts = await auth.api.listUserAccounts({
    headers: await headers(),
  });
  const hasPassword = accounts.some(
    (account) => account.providerId === "credential",
  );

  return (
    <ProfileForm
      initialName={session.user.name ?? ""}
      email={session.user.email}
      emailVerified={session.user.emailVerified}
      hasPassword={hasPassword}
    />
  );
}
