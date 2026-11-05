import { Link, Section, Text } from "@react-email/components";
import { type CampaignEmailLinks, CampaignFooter } from "./campaign-footer";
import { colors, linkStyle, StarivaLayout } from "./stariva-layout";

export interface StarivaElkaSupportInviteEmailProps extends CampaignEmailLinks {
  /** Ссылка кнопки — через сайт, чтобы засчитать переход в группу. */
  groupUrl: string;
  /** Ссылка на канал — тоже через сайт. */
  channelUrl: string;
}

export const ELKA_SUPPORT_INVITE_SUBJECT =
  "Приглашаю в группу поддержки по ёлке макраме";
export const ELKA_SUPPORT_INVITE_PREVIEW =
  "Там можно задать вопрос по урокам и показать свою ёлку";

const POINTS = [
  "задать вопрос, если что-то не получается;",
  "показать свою ёлку и посмотреть, что получилось у других;",
  "получить подсказку по узлам и шнуру.",
];

const textStyle = {
  margin: 0,
  fontSize: 15,
  lineHeight: "26px",
  color: colors.darkGrey,
} as const;

/**
 * Приглашение в закрытую группу поддержки для тех, кто купил мастер-класс по
 * ёлке, и заодно в канал Stariva. Говорит Ольга от себя. За покупку благодарит
 * только покупателей: адреса из ручного списка могли ничего не покупать.
 * Без props — пример для предпросмотра.
 */
export default function StarivaElkaSupportInviteEmail(
  props: StarivaElkaSupportInviteEmailProps = {
    groupUrl: "https://t.me/+example",
    channelUrl: "https://t.me/stariva",
    reason:
      "Вы получили это письмо, потому что купили мастер-класс на stariva.ru.",
    buyer: true,
    unsubscribeUrl: "https://stariva.ru/unsubscribe/example",
  },
) {
  return (
    <StarivaLayout
      previewText={ELKA_SUPPORT_INVITE_PREVIEW}
      heading="Приглашаю в группу поддержки"
      intro={
        props.buyer
          ? "Здравствуйте! Это Ольга. Спасибо, что выбрали мой мастер-класс по ёлке."
          : "Здравствуйте! Это Ольга, я плету макраме и веду мастер-классы."
      }
      beforeButton={
        <Section style={{ margin: "-12px 0 32px" }}>
          <Text style={{ ...textStyle, paddingBottom: 12 }}>
            Я открыла закрытую группу в Telegram для тех, кто плетёт ёлку по
            моим урокам. Там можно:
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
      buttonLabel="Вступить в группу"
      buttonUrl={props.groupUrl}
      // Под кнопкой — служебная ссылка через сайт: показывать её незачем
      linkFallback={false}
      footnote={props.reason}
      footer={
        <CampaignFooter
          unsubscribeUrl={props.unsubscribeUrl}
          openPixelUrl={props.openPixelUrl}
        />
      }
    >
      <Text style={{ ...textStyle, marginTop: 28 }}>
        А ещё у меня есть канал Stariva: там новые работы и мастер-классы.{" "}
        <Link href={props.channelUrl} style={linkStyle}>
          Перейти в канал
        </Link>
      </Text>
    </StarivaLayout>
  );
}
