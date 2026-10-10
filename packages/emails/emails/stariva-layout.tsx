import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/** Палитра сайта (apps/web globals.css): тёплый монохром без акцентного цвета. */
export const colors = {
  white: "#fdfcfb",
  offWhite: "#f5f3f0",
  lightGrey: "#eae8e4",
  midGrey: "#b0aca6",
  textGrey: "#6b6761",
  darkGrey: "#4a4845",
  nearBlack: "#161513",
} as const;

export const fonts = {
  sans: "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  serif: "'Cormorant Garamond',Georgia,'Times New Roman',serif",
} as const;

/** Подпись мелкими капителями, как .label-caps на сайте. */
export const labelCaps = {
  fontFamily: fonts.sans,
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontWeight: 500,
  color: colors.textGrey,
} as const;

export const linkStyle = {
  color: colors.nearBlack,
  textDecoration: "underline",
  textUnderlineOffset: "3px",
} as const;

const SITE_URL = "https://stariva.ru";

/** Brand-specific layout shared by all Stariva-branded transactional emails. */
export function StarivaLayout({
  previewText,
  heading,
  intro,
  buttonLabel,
  buttonUrl,
  footnote,
  children,
}: {
  previewText: string;
  heading: string;
  intro: string;
  buttonLabel: string;
  buttonUrl: string;
  footnote: string;
  children?: ReactNode;
}) {
  return (
    <Html lang="ru">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
        {/* Apple Mail и iOS подхватят шрифты сайта, остальные клиенты возьмут Georgia/системный */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Inter:wght@400;500&display=swap"
        />
      </Head>
      <Preview>{previewText}</Preview>
      <Body
        style={{
          margin: 0,
          padding: "40px 12px",
          background: colors.offWhite,
          fontFamily: fonts.sans,
          color: colors.nearBlack,
        }}
      >
        <Container style={{ maxWidth: 520, margin: "0 auto" }}>
          <Section style={{ padding: "0 0 28px", textAlign: "center" }}>
            <Link
              href={SITE_URL}
              style={{ color: colors.nearBlack, textDecoration: "none" }}
            >
              <Text
                style={{
                  margin: 0,
                  fontFamily: fonts.serif,
                  fontSize: 24,
                  lineHeight: "28px",
                  fontWeight: 500,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: colors.nearBlack,
                }}
              >
                Stariva
              </Text>
            </Link>
            {/* Нить под логотипом — тот же мотив, что в шапке сайта */}
            <div
              style={{
                width: 38,
                height: 1,
                margin: "6px auto 0",
                background: colors.nearBlack,
                lineHeight: "1px",
                fontSize: 0,
              }}
            />
          </Section>

          <Section
            style={{
              background: colors.white,
              border: `1px solid ${colors.lightGrey}`,
              borderRadius: 16,
              padding: "44px 32px 36px",
            }}
          >
            <Text
              style={{
                margin: "0 0 16px",
                fontFamily: fonts.serif,
                fontSize: 32,
                lineHeight: "38px",
                fontWeight: 500,
                color: colors.nearBlack,
              }}
            >
              {heading}
            </Text>
            <Text
              style={{
                margin: "0 0 32px",
                fontSize: 15,
                lineHeight: "26px",
                color: colors.darkGrey,
              }}
            >
              {intro}
            </Text>
            <Link
              href={buttonUrl}
              style={{
                display: "inline-block",
                background: colors.nearBlack,
                color: colors.white,
                textDecoration: "none",
                padding: "16px 34px",
                borderRadius: 999,
                fontSize: 12,
                lineHeight: "16px",
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {buttonLabel}
            </Link>
            {children}
            <Hr
              style={{
                margin: "36px 0 20px",
                border: "none",
                borderTop: `1px solid ${colors.lightGrey}`,
              }}
            />
            <Text
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: "19px",
                color: colors.textGrey,
              }}
            >
              {footnote}
            </Text>
            <Text
              style={{
                margin: "12px 0 0",
                fontSize: 12,
                lineHeight: "19px",
                color: colors.textGrey,
                wordBreak: "break-all",
              }}
            >
              Если кнопка не работает, скопируйте ссылку в браузер:
              <br />
              <Link href={buttonUrl} style={{ color: colors.darkGrey }}>
                {buttonUrl}
              </Link>
            </Text>
          </Section>

          <Section style={{ padding: "28px 24px 0", textAlign: "center" }}>
            <Text style={{ ...labelCaps, margin: "0 0 8px" }}>
              Макраме ручной работы
            </Text>
            <Text
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: "19px",
                color: colors.textGrey,
              }}
            >
              <Link
                href={SITE_URL}
                style={{ color: colors.textGrey, textDecoration: "none" }}
              >
                stariva.ru
              </Link>
              {"  ·  "}
              <Link
                href="mailto:info@stariva.ru"
                style={{ color: colors.textGrey, textDecoration: "none" }}
              >
                info@stariva.ru
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
