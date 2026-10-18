import { Section, Text } from "@react-email/components";
import { colors, labelCaps, StarivaLayout } from "./stariva-layout";

export interface StarivaWorkshopUnpaidEmailProps {
  workshopTitle: string;
  /** Страница мастер-класса, где можно снова нажать «Оплатить». */
  payUrl: string;
  /** Предзаказ ещё идёт: до какого момента и почём. */
  preorder?: {
    /** «20 октября в 10:00 (мск)». */
    deadlineLabel: string;
    /** «690 ₽». */
    priceLabel: string;
    /** «990 ₽» — цена после старта, если известна. */
    regularPriceLabel?: string;
    /** Подарок за предзаказ. */
    bonus?: { title: string; releaseLabel: string };
  };
}

export function workshopUnpaidEmailSubject({
  workshopTitle,
}: Pick<StarivaWorkshopUnpaidEmailProps, "workshopTitle">): string {
  return `Оплата мастер-класса «${workshopTitle}» не завершилась — Stariva`;
}

function preorderText({
  deadlineLabel,
  priceLabel,
  regularPriceLabel,
}: NonNullable<StarivaWorkshopUnpaidEmailProps["preorder"]>): string {
  const price = `Цена предзаказа — ${priceLabel}, она действует до ${deadlineLabel}.`;
  return regularPriceLabel
    ? `${price} Потом мастер-класс будет стоить ${regularPriceLabel}.`
    : price;
}

/**
 * Письмо тому, кто оформил мастер-класс, но не оплатил: одно, через час
 * после оформления. Без props — демонстрационные данные для предпросмотра.
 */
export default function StarivaWorkshopUnpaidEmail(
  props: StarivaWorkshopUnpaidEmailProps = {
    workshopTitle: "Ёлка макраме",
    payUrl: "https://stariva.ru/elka-makrame",
    preorder: {
      deadlineLabel: "20 октября в 10:00 (мск)",
      priceLabel: "690 ₽",
      regularPriceLabel: "990 ₽",
      bonus: {
        title: "мастер-класс по большой ёлке 75 × 150 см",
        releaseLabel: "3 ноября",
      },
    },
  },
) {
  const title = `«${props.workshopTitle}»`;
  const { preorder } = props;

  return (
    <StarivaLayout
      previewText={`Мастер-класс ${title} ещё можно оплатить`}
      heading="Оплата не завершилась"
      intro={`Здравствуйте, это Ольга. Вы начали оформлять мастер-класс ${title}, но оплата не прошла до конца. Так бывает: банк попросил подтверждение, страница закрылась или просто что-то отвлекло. Закончить можно по кнопке ниже — это пара минут.`}
      buttonLabel="Завершить оплату"
      buttonUrl={props.payUrl}
      footnote="Если вы передумали, ничего делать не нужно — больше напоминать не буду."
    >
      {preorder && (
        <Section
          style={{
            marginTop: 36,
            padding: "20px 22px",
            borderRadius: 12,
            background: colors.offWhite,
            border: `1px solid ${colors.lightGrey}`,
          }}
        >
          <Text style={{ ...labelCaps, margin: "0 0 8px" }}>Предзаказ</Text>
          <Text
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: "23px",
              color: colors.nearBlack,
            }}
          >
            {preorderText(preorder)}
            {preorder.bonus &&
              ` А ещё за предзаказ в подарок ${preorder.bonus.title} — он откроется в кабинете ${preorder.bonus.releaseLabel}.`}
          </Text>
        </Section>
      )}
    </StarivaLayout>
  );
}
