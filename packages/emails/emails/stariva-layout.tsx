import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

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
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          margin: 0,
          padding: "32px 0",
          background: "#f7f3ec",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
          color: "#2c241b",
        }}
      >
        <Container
          style={{
            maxWidth: 480,
            margin: "0 auto",
            background: "#fffdf9",
            border: "1px solid #e8e0d4",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <Section
            style={{ padding: "28px 32px", borderBottom: "1px solid #efe8dc" }}
          >
            <Text
              style={{
                fontSize: 20,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 600,
                color: "#2c241b",
                margin: 0,
              }}
            >
              Stariva
            </Text>
          </Section>
          <Section style={{ padding: 32 }}>
            <Text
              style={{
                margin: "0 0 12px",
                fontSize: 22,
                fontWeight: 600,
                color: "#2c241b",
              }}
            >
              {heading}
            </Text>
            <Text
              style={{
                margin: "0 0 24px",
                fontSize: 15,
                lineHeight: "1.7",
                color: "#6f6253",
              }}
            >
              {intro}
            </Text>
            <Link
              href={buttonUrl}
              style={{
                display: "inline-block",
                background: "#b85c38",
                color: "#fffdf9",
                textDecoration: "none",
                padding: "13px 28px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {buttonLabel}
            </Link>
            {children}
            <Text
              style={{
                margin: "24px 0 0",
                fontSize: 12,
                lineHeight: "1.6",
                color: "#9c8e7d",
              }}
            >
              {footnote}
            </Text>
            <Text
              style={{
                margin: "16px 0 0",
                fontSize: 12,
                lineHeight: "1.6",
                color: "#9c8e7d",
                wordBreak: "break-all",
              }}
            >
              Если кнопка не работает, скопируйте ссылку:
              <br />
              <Link href={buttonUrl} style={{ color: "#b85c38" }}>
                {buttonUrl}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
