import { StarivaLayout } from "./stariva-layout";

export default function StarivaResetPasswordEmail({
  url = "https://stariva.example.com/auth/reset-password?token=abc123",
}: {
  url?: string;
}) {
  return (
    <StarivaLayout
      previewText="Сброс пароля — Stariva"
      heading="Сброс пароля"
      intro="Вы запросили смену пароля. Нажмите кнопку, чтобы задать новый пароль для входа в кабинет."
      buttonLabel="Сбросить пароль"
      buttonUrl={url}
      footnote="Если вы не запрашивали сброс пароля, проигнорируйте это письмо."
    />
  );
}
