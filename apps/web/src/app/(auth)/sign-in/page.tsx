import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "../auth-card";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Вход в личный кабинет",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <AuthCard
      title="Вход"
      description="Войдите, чтобы смотреть купленные мастер-классы в личном кабинете."
      footer={
        <span>
          Нет аккаунта?{" "}
          <Link href="/sign-up" className="text-terracotta hover:underline">
            Зарегистрироваться
          </Link>
        </span>
      }
    >
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
