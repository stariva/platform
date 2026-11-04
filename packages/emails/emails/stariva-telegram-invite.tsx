import { Section, Text } from "@react-email/components";
import { type CampaignEmailLinks, CampaignFooter } from "./campaign-footer";
import { colors, StarivaLayout } from "./stariva-layout";

export interface StarivaTelegramInviteEmailProps extends CampaignEmailLinks {
  /** Ссылка кнопки — через сайт, чтобы засчитать переход в канал. */
  channelUrl: string;
}

export const TELEGRAM_INVITE_SUBJECT =
  "Приглашаю в Telegram-канал для участниц мастер-классов — Stariva";
export const TELEGRAM_INVITE_PREVIEW =
  "Вопросы по курсу, ваши ёлки и подсказки — в одном месте";

const POINTS = [
  "спросить, если узел не получается или шнур ведёт себя не так;",
  "показать свою ёлку и посмотреть, что получилось у других;",
  "найти подсказки по материалам и уходу за готовой работой.",
];

const textStyle = {
  margin: 0,
  fontSize: 15,
  lineHeight: "26px",
  color: colors.darkGrey,
} as const;

/**
 * Приглашение покупателей мастер-классов в Telegram-канал. Письмо для тех,
 * кто уже учится, — без продажи новых курсов. Без props — пример для
 * предпросмотра.
 */
export default function StarivaTelegramInviteEmail(
  props: StarivaTelegramInviteEmailProps = {
    channelUrl: "https://t.me/stariva",
    reason: "Письмо пришло, потому что вы купили мастер-класс на stariva.ru.",
    unsubscribeUrl: "https://stariva.ru/unsubscribe/example",
  },
) {
  return (
    <StarivaLayout
      previewText={TELEGRAM_INVITE_PREVIEW}
      heading="Приглашаю в наш канал"
      intro="Здравствуйте, это Ольга. Спасибо, что плетёте вместе со мной! Я завела Telegram-канал для тех, кто проходит мои мастер-классы. Там можно:"
      beforeButton={
        <Section style={{ margin: "-16px 0 32px" }}>
          {/* Список абзацами с тире: ul почтовики рисуют по-разному */}
          {POINTS.map((point) => (
            <Text key={point} style={{ ...textStyle, paddingBottom: 8 }}>
              <span style={{ color: colors.textGrey }}>—&nbsp;</span>
              {point}
            </Text>
          ))}
          <Text style={{ ...textStyle, marginTop: 12 }}>
            Приходите — буду рада видеть вас там.
          </Text>
        </Section>
      }
      buttonLabel="Перейти в канал"
      buttonUrl={props.channelUrl}
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
