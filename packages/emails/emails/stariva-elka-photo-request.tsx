import { Section, Text } from "@react-email/components";
import { type CampaignEmailLinks, CampaignFooter } from "./campaign-footer";
import { colors, StarivaLayout } from "./stariva-layout";

export interface StarivaElkaPhotoRequestEmailProps extends CampaignEmailLinks {
  /** Ссылка кнопки — через сайт, чтобы засчитать переход в переписку. */
  contactUrl: string;
}

export const ELKA_PHOTO_REQUEST_SUBJECT = "Покажете, какая получилась ёлка?";
export const ELKA_PHOTO_REQUEST_PREVIEW =
  "Пара слов и фото — мне важно увидеть, что у вас вышло";

const POINTS = [
  "фото ёлки: на стене, на полу — как удобно;",
  "пару слов о том, как шло плетение и что оказалось сложным;",
  "можно ли показать фото на сайте и как вас подписать: по имени или, например, «из Томска».",
];

const textStyle = {
  margin: 0,
  fontSize: 15,
  lineHeight: "26px",
  color: colors.darkGrey,
} as const;

/**
 * Просьба прислать фото готовой ёлки и пару слов о мастер-классе. Говорит
 * Ольга от себя, ничего не продаёт и не обещает взамен. Фото показывают на
 * сайте только с согласия автора — об этом сказано в письме. За покупку
 * благодарит только покупателей: адреса из ручного списка могли ничего не
 * покупать. Без props — пример для предпросмотра.
 */
export default function StarivaElkaPhotoRequestEmail(
  props: StarivaElkaPhotoRequestEmailProps = {
    contactUrl: "https://t.me/Olga_Stariva",
    reason:
      "Вы получили это письмо, потому что купили мастер-класс на stariva.ru.",
    buyer: true,
    unsubscribeUrl: "https://stariva.ru/unsubscribe/example",
  },
) {
  return (
    <StarivaLayout
      previewText={ELKA_PHOTO_REQUEST_PREVIEW}
      heading="Покажете, что получилось?"
      intro={
        props.buyer
          ? "Здравствуйте! Это Ольга. Спасибо, что выбрали мой мастер-класс по плетению ёлки."
          : "Здравствуйте! Это Ольга, я плету макраме и веду мастер-классы."
      }
      beforeButton={
        <Section>
          <Text style={{ ...textStyle, paddingBottom: 12 }}>
            Если ваша ёлка уже готова или почти готова, пришлите мне её фото.
            Мне важно увидеть, что вышло, и понять, где в уроках стоит объяснить
            подробнее. Напишите мне:
          </Text>
          {/* Список абзацами с тире: ul почтовики рисуют по-разному */}
          {POINTS.map((point) => (
            <Text key={point} style={{ ...textStyle, paddingBottom: 6 }}>
              <span style={{ color: colors.textGrey }}>—&nbsp;</span>
              {point}
            </Text>
          ))}
          {/* Отступ до кнопки — padding абзаца: отрицательный margin у таблицы почтовики выбрасывают */}
          <Text style={{ ...textStyle, marginTop: 16, paddingBottom: 36 }}>
            Без вашего согласия фото я нигде не покажу. А если ёлка ещё в
            работе, напишите, когда закончите, — я подожду.
          </Text>
        </Section>
      }
      buttonLabel="Прислать фото"
      buttonUrl={props.contactUrl}
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
