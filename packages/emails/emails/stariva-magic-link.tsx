import { StarivaLayout } from "./stariva-layout";

export default function StarivaMagicLinkEmail({
  url = "https://stariva.example.com/auth/magic-link?token=abc123",
}: {
  url?: string;
}) {
  return (
    <StarivaLayout
      previewText="Вход в личный кабинет — Stariva"
      heading="Вход в личный кабинет"
      intro="Нажмите кнопку ниже, чтобы войти в кабинет Stariva. Ссылка действует ограниченное время и работает один раз."
      buttonLabel="Войти"
      buttonUrl={url}
      footnote="Если вы не запрашивали вход, просто проигнорируйте это письмо — ваш аккаунт в безопасности."
    />
  );
}
