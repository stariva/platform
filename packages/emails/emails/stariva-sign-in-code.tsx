import { Section, Text } from "@react-email/components";
import { colors, fonts, labelCaps, StarivaLayout } from "./stariva-layout";

/**
 * Тема письма с кодом. Код в начале темы виден прямо в уведомлении на
 * телефоне — письмо можно не открывать.
 */
export function signInCodeSubject(otp: string): string {
  return `${otp} — код для входа в Stariva`;
}

/** «482719» → «482 719»: так код легче прочитать и переписать. */
function groupDigits(otp: string): string {
  return otp.length === 6 ? `${otp.slice(0, 3)} ${otp.slice(3)}` : otp;
}

export interface StarivaSignInCodeEmailProps {
  otp: string;
  /** Кнопка входа без кода (магическая ссылка) — только для существующих аккаунтов. */
  url?: string;
  /** Адреса без аккаунта: кабинет появится после ввода кода на сайте. */
  isNewUser?: boolean;
  expiresInMinutes?: number;
}

export default function StarivaSignInCodeEmail({
  otp = "482719",
  url,
  isNewUser = false,
  expiresInMinutes = 10,
}: StarivaSignInCodeEmailProps) {
  return (
    <StarivaLayout
      previewText={`Код для входа: ${groupDigits(otp)}. Действует ${expiresInMinutes} минут.`}
      heading={isNewUser ? "Добро пожаловать" : "Вход в личный кабинет"}
      intro={
        isNewUser
          ? "Введите этот код на сайте — и мы создадим ваш личный кабинет Stariva."
          : url
            ? "Введите этот код на странице входа. Если читаете письмо на том же устройстве, можно просто нажать кнопку."
            : "Введите этот код на странице входа."
      }
      beforeButton={
        <Section
          style={{
            margin: url ? "0 0 32px" : "0",
            padding: "22px 16px 18px",
            background: colors.offWhite,
            borderRadius: 12,
            textAlign: "center",
          }}
        >
          <Text style={{ ...labelCaps, margin: "0 0 6px" }}>Код для входа</Text>
          <Text
            style={{
              margin: 0,
              fontFamily: fonts.sans,
              fontSize: 36,
              lineHeight: "44px",
              fontWeight: 500,
              letterSpacing: "0.12em",
              color: colors.nearBlack,
            }}
          >
            {groupDigits(otp)}
          </Text>
          <Text
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              lineHeight: "18px",
              color: colors.textGrey,
            }}
          >
            {`Действует ${expiresInMinutes} минут`}
          </Text>
        </Section>
      }
      buttonLabel={url ? "Войти без кода" : undefined}
      buttonUrl={url}
      footnote="Если вы не запрашивали вход, просто проигнорируйте письмо — без кода в аккаунт никто не войдёт."
    />
  );
}
