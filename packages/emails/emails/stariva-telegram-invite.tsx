import { Section, Text } from "@react-email/components";
import { type CampaignEmailLinks, CampaignFooter } from "./campaign-footer";
import { colors, StarivaLayout } from "./stariva-layout";

export interface StarivaTelegramInviteEmailProps extends CampaignEmailLinks {
  /** Ссылка кнопки — через сайт, чтобы засчитать переход в канал. */
  channelUrl: string;
}

export const TELEGRAM_INVITE_SUBJECT = "Приглашаю вас в свой Telegram-канал";
export const TELEGRAM_INVITE_PREVIEW =
  "Там можно задать вопрос по урокам и показать свою ёлку";

const POINTS = [
  "задать вопрос, если что-то не получается;",
  "показать свою ёлку и посмотреть работы других;",
  "получить подсказки по узлам и шнуру.",
];

const textStyle = {
  margin: 0,
  fontSize: 15,
  lineHeight: "26px",
  color: colors.darkGrey,
} as const;

/**
 * Приглашение покупателей мастер-классов в Telegram-канал Ольги. Письмо для
 * тех, кто уже учится, — без продажи новых курсов. Говорит Ольга от себя:
 * канал её, а не «наш». Без props — пример для предпросмотра.
 */
export default function StarivaTelegramInviteEmail(
  props: StarivaTelegramInviteEmailProps = {
    channelUrl: "https://t.me/stariva",
    reason:
      "Вы получили это письмо, потому что купили мастер-класс на stariva.ru.",
    unsubscribeUrl: "https://stariva.ru/unsubscribe/example",
  },
) {
  return (
    <StarivaLayout
      previewText={TELEGRAM_INVITE_PREVIEW}
      heading="Приглашаю в свой канал"
      intro="Здравствуйте! Это Ольга. Спасибо, что выбрали мой мастер-класс."
      beforeButton={
        <Section style={{ margin: "-12px 0 32px" }}>
          <Text style={{ ...textStyle, paddingBottom: 12 }}>
            Я завела канал в Telegram для всех, кто учится по моим урокам. Там
            можно:
          </Text>
          {/* Список абзацами с тире: ul почтовики рисуют по-разному */}
          {POINTS.map((point) => (
            <Text key={point} style={{ ...textStyle, paddingBottom: 6 }}>
              <span style={{ color: colors.textGrey }}>—&nbsp;</span>
              {point}
            </Text>
          ))}
          <Text style={{ ...textStyle, marginTop: 16 }}>
            Заходите, буду рада!
          </Text>
        </Section>
      }
      buttonLabel="Перейти в канал"
      buttonUrl={props.channelUrl}
      // Под кнопкой — служебная ссылка через сайт: показывать её незачем
      linkFallback={false}
      footnote={props.reason}
      footer={
        <CampaignFooter
          unsubscribeUrl={props.unsubscribeUrl}
          openPixelUrl={props.openPixelUrl}
        />
      }
    />
  );
}
