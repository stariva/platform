import { Img, Link, Text } from "@react-email/components";
import { Fragment } from "react";
import { colors, StarivaLayout } from "./stariva-layout";

export interface StarivaCampaignEmailProps {
  previewText: string;
  heading: string;
  /** Простой текст из админки: пустая строка разделяет абзацы. */
  body: string;
  buttonLabel?: string | null;
  /** Ссылка кнопки — уже через сайт, чтобы засчитать переход. */
  buttonUrl?: string | null;
  /** Почему пришло письмо: «вы купили мастер-класс на stariva.ru». */
  reason: string;
  unsubscribeUrl: string;
  /** Картинка-пиксель: по ней видно, что письмо открыли. */
  openPixelUrl?: string;
}

/** Абзацы текста рассылки; одиночный перенос строки остаётся переносом. */
export function campaignParagraphs(body: string): string[][] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0);
}

const paragraphStyle = {
  margin: "0 0 20px",
  fontSize: 15,
  lineHeight: "26px",
  color: colors.darkGrey,
} as const;

function Lines({ lines }: { lines: string[] }) {
  return lines.map((line, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: строки абзаца не переставляются
    <Fragment key={index}>
      {index > 0 && <br />}
      {line}
    </Fragment>
  ));
}

/**
 * Письмо рассылки из админки: заголовок, абзацы текста и кнопка. Внизу —
 * почему пришло письмо и ссылка на отписку. Без props — пример для
 * предпросмотра.
 */
export default function StarivaCampaignEmail(
  props: StarivaCampaignEmailProps = {
    previewText: "Сообщество для тех, кто плетёт ёлки вместе со мной",
    heading: "Приглашаю в сообщество",
    body: "Здравствуйте, это Ольга.\n\nЯ завела Telegram-канал для тех, кто проходит мои мастер-классы. Там можно задать вопрос по курсу, показать свою ёлку и посмотреть работы других.\n\nПриходите, буду рада.",
    buttonLabel: "Перейти в канал",
    buttonUrl: "https://t.me/stariva",
    reason: "Письмо пришло, потому что вы купили мастер-класс на stariva.ru.",
    unsubscribeUrl: "https://stariva.ru/unsubscribe/example",
  },
) {
  const [first = [], ...rest] = campaignParagraphs(props.body);
  const button =
    props.buttonLabel && props.buttonUrl
      ? { buttonLabel: props.buttonLabel, buttonUrl: props.buttonUrl }
      : {};

  return (
    <StarivaLayout
      previewText={props.previewText || first.join(" ")}
      heading={props.heading}
      intro={<Lines lines={first} />}
      beforeButton={
        rest.length > 0 ? (
          <div style={{ margin: "-12px 0 32px" }}>
            {rest.map((lines, index) => (
              <Text
                // biome-ignore lint/suspicious/noArrayIndexKey: абзацы не переставляются
                key={index}
                style={
                  index === rest.length - 1
                    ? { ...paragraphStyle, margin: 0 }
                    : paragraphStyle
                }
              >
                <Lines lines={lines} />
              </Text>
            ))}
          </div>
        ) : undefined
      }
      {...button}
      footnote={props.reason}
      footer={
        <>
          <Text
            style={{
              margin: "12px 0 0",
              fontSize: 12,
              lineHeight: "19px",
              color: colors.textGrey,
            }}
          >
            Не хотите получать такие письма?{" "}
            <Link
              href={props.unsubscribeUrl}
              style={{ color: colors.darkGrey }}
            >
              Отписаться
            </Link>
          </Text>
          {props.openPixelUrl && (
            <Img
              src={props.openPixelUrl}
              width="1"
              height="1"
              alt=""
              style={{ display: "block", width: 1, height: 1, border: 0 }}
            />
          )}
        </>
      }
    />
  );
}
