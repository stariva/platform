import { Section, Text } from "@react-email/components";
import { colors, labelCaps, StarivaLayout } from "./stariva-layout";

export interface StarivaWorkshopBriefEmailProps {
  workshopTitle: string;
  /** Личная ссылка: открывает кабинет без пароля. */
  accessUrl: string;
  /** Подписи PDF во вложении: «Бриф «Ёлка макраме»». */
  files: string[];
}

export const workshopBriefEmailSubject = ({
  workshopTitle,
}: Pick<StarivaWorkshopBriefEmailProps, "workshopTitle">) =>
  `Бриф к мастер-классу «${workshopTitle}» — Stariva`;

/**
 * Письмо с PDF-брифом во вложении: что купить к мастер-классу, где и как
 * подготовиться. Без props использует демонстрационные данные для
 * предпросмотра шаблона.
 */
export default function StarivaWorkshopBriefEmail(
  props: StarivaWorkshopBriefEmailProps = {
    workshopTitle: "Ёлка макраме",
    accessUrl: "https://stariva.ru/api/workshops/access/abc",
    files: ["Бриф «Ёлка макраме»"],
  },
) {
  const title = `«${props.workshopTitle}»`;
  return (
    <StarivaLayout
      previewText={`Бриф к мастер-классу ${title}`}
      heading="Бриф к мастер-классу"
      intro={`Во вложении — PDF к мастер-классу ${title}: что купить, где и как подготовиться. Бриф всегда есть и в личном кабинете.`}
      buttonLabel="Открыть кабинет"
      buttonUrl={props.accessUrl}
      footnote="Кнопка в письме открывает ваш кабинет без пароля, поэтому не пересылайте это письмо другим людям."
    >
      <AttachedFiles files={props.files} />
    </StarivaLayout>
  );
}

/** Список PDF во вложении — общий для письма с брифом и письма о покупке. */
export function AttachedFiles({
  files,
  hint,
}: {
  files: string[];
  hint?: string;
}) {
  if (files.length === 0) return null;
  return (
    <Section
      style={{
        marginTop: 32,
        padding: "20px 22px",
        borderRadius: 12,
        background: colors.offWhite,
        border: `1px solid ${colors.lightGrey}`,
      }}
    >
      <Text style={{ ...labelCaps, margin: "0 0 8px" }}>📎 Во вложении</Text>
      {files.map((file) => (
        <Text
          key={file}
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: "23px",
            color: colors.nearBlack,
          }}
        >
          {`${file} · PDF`}
        </Text>
      ))}
      {hint && (
        <Text
          style={{
            margin: "8px 0 0",
            fontSize: 13,
            lineHeight: "21px",
            color: colors.darkGrey,
          }}
        >
          {hint}
        </Text>
      )}
    </Section>
  );
}
