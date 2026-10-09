import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "../auth-card";
import { VerifyEmailButton } from "./verify-email-button";

export const metadata: Metadata = {
  title: "Подтверждение email",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <AuthCard
      title="Подтвердите email"
      description="Нажмите кнопку, чтобы подтвердить адрес и войти в личный кабинет."
    >
      <Suspense fallback={null}>
        <VerifyEmailButton />
      </Suspense>
    </AuthCard>
  );
}
