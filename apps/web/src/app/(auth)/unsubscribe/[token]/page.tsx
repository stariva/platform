import type { Metadata } from "next";
import Link from "next/link";
import { findRecipient } from "@/lib/campaigns/tracking";
import { AuthCard } from "../../auth-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Отписка от рассылки",
  robots: { index: false, follow: false },
};

const buttonClass =
  "w-full inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-near-black text-white font-sans text-xs tracking-widest uppercase hover:bg-dark-grey transition-colors";

const homeLink = (
  <Link href="/" className="text-terracotta underline-offset-2 hover:underline">
    На главную
  </Link>
);

/**
 * Страница из ссылки «Отписаться» в письме рассылки. Отписывает только
 * кнопка: саму ссылку открывают и антивирусы, и превью почтовиков.
 */
export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  if (error) {
    return (
      <AuthCard
        title="Не получилось отписать"
        description="На сайте что-то сломалось. Попробуйте ещё раз чуть позже или напишите на info@stariva.ru — отпишу вас сама."
        footer={homeLink}
      >
        {null}
      </AuthCard>
    );
  }

  if (token.startsWith("test-")) {
    return (
      <AuthCard
        title="Это пробное письмо"
        description="Ссылка из пробного письма ни на что не влияет. В настоящем письме здесь будет кнопка «Отписаться»."
        footer={homeLink}
      >
        {null}
      </AuthCard>
    );
  }

  const recipient = await findRecipient(token);
  if (!recipient) {
    return (
      <AuthCard
        title="Ссылка не работает"
        description="Не нашла такую рассылку. Если письма всё равно приходят, напишите на info@stariva.ru — отпишу вас сама."
        footer={homeLink}
      >
        {null}
      </AuthCard>
    );
  }

  // Только по базе: форма отписывает до перехода сюда, а не ссылкой
  if (recipient.unsubscribed) {
    return (
      <AuthCard
        title="Вы отписались"
        description={`Больше не буду присылать рассылки на ${recipient.email}. Письма о заказах и доступах к мастер-классам по-прежнему будут приходить.`}
        footer={homeLink}
      >
        {null}
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Отписаться от рассылки?"
      description={`Перестану присылать новости и приглашения на ${recipient.email}. Письма о заказах и доступах к мастер-классам по-прежнему будут приходить.`}
      footer={homeLink}
    >
      <form method="post" action={`/api/m/u/${encodeURIComponent(token)}`}>
        <button type="submit" className={buttonClass}>
          Отписаться
        </button>
      </form>
    </AuthCard>
  );
}
