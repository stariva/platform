import { StarivaLayout } from "./stariva-layout";

export default function StarivaVerifyEmail({
  url = "https://stariva.example.com/auth/verify?token=abc123",
}: {
  url?: string;
}) {
  return (
    <StarivaLayout
      previewText="Подтвердите email — Stariva"
      heading="Подтвердите ваш email"
      intro="Спасибо за регистрацию! Подтвердите адрес электронной почты, чтобы получить доступ к личному кабинету и купленным мастер-классам."
      buttonLabel="Подтвердить email"
      buttonUrl={url}
      footnote="Если вы не регистрировались на Stariva, просто проигнорируйте это письмо."
    />
  );
}
