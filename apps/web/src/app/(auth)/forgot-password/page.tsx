import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Восстановление пароля",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Восстановление пароля"
      description="Укажите email — мы отправим ссылку для создания нового пароля."
      footer={
        <Link href="/sign-in" className="text-terracotta hover:underline">
          Вернуться ко входу
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
