import { getSession } from "@/lib/auth/session";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <ProfileForm
      initialName={session.user.name ?? ""}
      email={session.user.email}
      emailVerified={session.user.emailVerified}
    />
  );
}
