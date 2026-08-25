import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "../auth-card";
import { MagicLinkForm } from "./magic-link-form";

export const metadata: Metadata = {
  title: "Вход по ссылке",
  robots: { index: false, follow: false },
};

export default function MagicLinkPage() {
  return (
    <AuthCard
      title="Вход по ссылке"
      description="Введите email — мы отправим ссылку для входа без пароля."
      footer={
        <Link href="/sign-in" className="text-terracotta hover:underline">
          Войти с паролем
        </Link>
      }
    >
      <Suspense fallback={null}>
        <MagicLinkForm />
      </Suspense>
    </AuthCard>
  );
}
