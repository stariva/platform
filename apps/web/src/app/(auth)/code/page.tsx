import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../auth-card";
import { CodeForm } from "./code-form";

export const metadata: Metadata = {
  title: "Код доступа к мастер-классу",
  description:
    "Купили мастер-класс Stariva не на сайте или получили его с набором? Введите код — откроем видеоуроки.",
  robots: { index: false, follow: false },
};

/**
 * Активация кода: с маркетплейса (пока Ярмарка Мастеров) или с купона в
 * коробке с набором. Адрес короткий: его печатаем в PDF-брифе и на купоне
 * рядом с QR-кодом.
 */
export default async function CodePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  // QR на купоне из набора ведёт на /code?c=482719 — код уже в клетках
  const { c } = await searchParams;
  const initialCode =
    (Array.isArray(c) ? c[0] : c)?.replace(/\D/g, "").slice(0, 6) ?? "";

  return (
    <AuthCard
      title="Код доступа"
      description="Введите код из сообщения Ольги или с купона в наборе — откроем видеоуроки."
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
      <CodeForm initialCode={initialCode} />
    </AuthCard>
  );
}
