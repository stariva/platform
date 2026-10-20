import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../auth-card";
import { CodeForm } from "./code-form";

export const metadata: Metadata = {
  title: "Код доступа к мастер-классу",
  description:
    "Купили мастер-класс Stariva не на сайте? Введите код из сообщения — откроем видеоуроки.",
  robots: { index: false, follow: false },
};

/**
 * Активация кода с маркетплейса (пока Ярмарка Мастеров). Адрес короткий: его печатаем
 * в PDF-брифе рядом с QR-кодом.
 */
export default function CodePage() {
  return (
    <AuthCard
      title="Код доступа"
      description="Введите код, который Ольга прислала после покупки, — откроем видеоуроки."
      footer={
        <span>
          Уже вводили код?{" "}
          <Link
            href="/sign-in?callbackURL=/account"
            className="text-terracotta hover:underline"
          >
            Войти
          </Link>
        </span>
      }
    >
      <CodeForm />
    </AuthCard>
  );
}
