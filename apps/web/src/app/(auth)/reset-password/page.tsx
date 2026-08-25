import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "../auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Новый пароль",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Новый пароль"
      description="Задайте новый пароль для входа в кабинет."
    >
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
