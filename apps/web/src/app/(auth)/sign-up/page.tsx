import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "../auth-card";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Регистрация",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <AuthCard
      title="Регистрация"
      description="Создайте аккаунт, чтобы покупать и смотреть мастер-классы Stariva."
      footer={
        <span>
          Уже есть аккаунт?{" "}
          <Link href="/sign-in" className="text-terracotta hover:underline">
            Войти
          </Link>
        </span>
      }
    >
      <Suspense fallback={null}>
        <SignUpForm />
      </Suspense>
    </AuthCard>
  );
}
