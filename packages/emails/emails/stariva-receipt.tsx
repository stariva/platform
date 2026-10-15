import { Img, Section, Text } from "@react-email/components";
import { colors, labelCaps, StarivaLayout } from "./stariva-layout";

export interface StarivaReceiptEmailProps {
  /** «заказу №1042» или «мастер-классу «Ёлка макраме»» — за что чек. */
  subject: string;
  /** Номер чека в «Мой налог», например 203e2ralw5. */
  receiptNumber: string;
  /** Картинка чека на сервисе ФНС. */
  receiptUrl: string;
}

/** Ширина картинки чека: сервис ФНС отдаёт её 320 px. */
const RECEIPT_WIDTH = 280;

/**
 * Письмо с чеком НПД: картинка чека из «Мой налог» прямо в письме и кнопка,
 * открывающая его на сайте ФНС. Без props — демонстрационный чек.
 */
export default function StarivaReceiptEmail(
  props: StarivaReceiptEmailProps = {
    subject: "заказу №1042",
    receiptNumber: "203e2ralw5",
    receiptUrl:
      "https://lknpd.nalog.ru/api/v1/receipt/502480197143/203e2ralw5/print",
  },
) {
  return (
    <StarivaLayout
      previewText={`Чек по ${props.subject}`}
      heading="Чек об оплате"
      intro={`Отправляем чек по ${props.subject}. Ольга работает как самозанятая, поэтому чек сформирован в приложении ФНС «Мой налог».`}
      buttonLabel="Открыть чек"
      buttonUrl={props.receiptUrl}
      footnote="Сохраните это письмо: чек пригодится, если понадобится вернуть или обменять покупку. Если остались вопросы, напишите на info@stariva.ru."
    >
      <Section style={{ marginTop: 32 }}>
        <Text style={{ ...labelCaps, margin: "0 0 12px" }}>
          Чек №{props.receiptNumber}
        </Text>
        <Img
          src={props.receiptUrl}
          alt={`Чек №${props.receiptNumber}`}
          width={RECEIPT_WIDTH}
          style={{
            display: "block",
            width: RECEIPT_WIDTH,
            maxWidth: "100%",
            height: "auto",
            border: `1px solid ${colors.lightGrey}`,
            borderRadius: 12,
          }}
        />
      </Section>
    </StarivaLayout>
  );
}

/** Тема письма с чеком. */
export function receiptEmailSubject(props: StarivaReceiptEmailProps): string {
  return `Чек по ${props.subject} — Stariva`;
}
