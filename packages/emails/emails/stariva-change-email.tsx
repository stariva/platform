import { StarivaLayout } from "./stariva-layout";

export default function StarivaChangeEmailEmail({
  url = "https://stariva.example.com/auth/verify?token=abc123",
}: {
  url?: string;
}) {
  return (
    <StarivaLayout
      previewText="Подтвердите смену email — Stariva"
      heading="Подтвердите новый email"
      intro="Вы запросили смену адреса электронной почты в аккаунте Stariva. Подтвердите новый адрес, нажав на кнопку."
      buttonLabel="Подтвердить email"
      buttonUrl={url}
      footnote="Если вы не запрашивали смену email, проигнорируйте это письмо."
    />
  );
}
