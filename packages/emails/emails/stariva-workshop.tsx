import { Link, Section, Text } from "@react-email/components";
import { StarivaLayout } from "./stariva-layout";

/**
 * booked — сразу после оплаты; week, day, release — за неделю, за день и в
 * момент открытия уроков предзаказа.
 */
export type WorkshopEmailKind = "booked" | "week" | "day" | "release";

export interface StarivaWorkshopEmailProps {
  kind: WorkshopEmailKind;
  workshopTitle: string;
  /** «1 ноября в 10:00 (мск)». null — уроки уже открыты. */
  releaseLabel: string | null;
  /** Личная ссылка: открывает кабинет без пароля. */
  accessUrl: string;
  materials: string[];
  /** Ссылки «Добавить в календарь» — только для предзаказа. */
  calendar?: { icsUrl: string; googleUrl: string };
  /** Подписка на напоминания в Telegram, если бот настроен. */
  telegramUrl?: string;
  /** Подарок за предзаказ — только в письме о покупке. */
  bonus?: { title: string; releaseLabel: string };
}

const muted = { color: "#6f6253", fontSize: 14, lineHeight: "1.6" };
const linkStyle = { color: "#b85c38" };

function copy({
  kind,
  workshopTitle,
  releaseLabel,
}: StarivaWorkshopEmailProps) {
  const title = `«${workshopTitle}»`;
  switch (kind) {
    case "booked":
      return releaseLabel
        ? {
            preview: `Вы записаны на мастер-класс ${title}`,
            heading: "Вы записаны!",
            intro: `Спасибо за предзаказ мастер-класса ${title}. Уроки откроются ${releaseLabel}, а мы напомним о старте за неделю, за день и в сам день. Войти в личный кабинет можно по кнопке ниже — пароль не нужен.`,
            button: "Открыть кабинет",
          }
        : {
            preview: `Доступ к мастер-классу ${title} открыт`,
            heading: "Доступ открыт",
            intro: `Спасибо за покупку! Мастер-класс ${title} уже ждёт вас в личном кабинете. Смотрите уроки когда удобно — доступ бессрочный.`,
            button: "Смотреть уроки",
          };
    case "week":
      return {
        preview: `Через неделю старт: ${title}`,
        heading: "До старта неделя",
        intro: `Уроки мастер-класса ${title} откроются ${releaseLabel ?? "совсем скоро"}. Самое время подготовить материалы, чтобы начать плести в первый же день.`,
        button: "Открыть кабинет",
      };
    case "day":
      return {
        preview: `Завтра открываем уроки: ${title}`,
        heading: "Завтра стартуем",
        intro: `Уроки мастер-класса ${title} откроются ${releaseLabel ?? "завтра"}. Проверьте, всё ли готово к работе. Войти в кабинет можно по кнопке ниже, без пароля.`,
        button: "Открыть кабинет",
      };
    case "release":
      return {
        preview: `Уроки открыты: ${title}`,
        heading: "Уроки открыты!",
        intro: `Мастер-класс ${title} уже в вашем кабинете. Занимайтесь в удобном темпе и возвращайтесь к урокам когда захочется.`,
        button: "Смотреть уроки",
      };
  }
}

export default function StarivaWorkshopEmail(
  props: StarivaWorkshopEmailProps = {
    kind: "booked",
    workshopTitle: "Макраме-ёлка",
    releaseLabel: "1 ноября в 10:00 (мск)",
    accessUrl: "https://stariva.ru/api/workshops/access/abc",
    materials: ["Хлопковый шнур 5 мм — 60 м", "Деревянная палочка 50 см"],
    calendar: {
      icsUrl: "https://stariva.ru/api/workshops/elka-makrame/calendar",
      googleUrl: "https://calendar.google.com",
    },
    telegramUrl: "https://t.me/stariva_bot?start=abc",
    bonus: {
      title: "мастер-класс по большой ёлке 75 × 150 см",
      releaseLabel: "3 ноября",
    },
  },
) {
  const text = copy(props);
  const showMaterials = props.materials.length > 0 && props.kind !== "release";

  return (
    <StarivaLayout
      previewText={text.preview}
      heading={text.heading}
      intro={text.intro}
      buttonLabel={text.button}
      buttonUrl={props.accessUrl}
      footnote="Кнопка в письме открывает ваш кабинет без пароля, поэтому не пересылайте это письмо другим людям."
    >
      {props.bonus && props.kind === "booked" && (
        <Text
          style={{
            margin: "28px 0 0",
            padding: "14px 16px",
            borderRadius: 12,
            background: "#f7f3ec",
            fontSize: 14,
            lineHeight: "1.6",
            color: "#2c241b",
          }}
        >
          🎁 Подарок за предзаказ: {props.bonus.title}. Он появится в вашем
          кабинете {props.bonus.releaseLabel} — доплачивать ничего не нужно.
        </Text>
      )}
      {showMaterials && (
        <Section style={{ marginTop: 28 }}>
          <Text style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>
            Что понадобится
          </Text>
          {props.materials.map((item) => (
            <Text key={item} style={{ ...muted, margin: "0 0 4px" }}>
              • {item}
            </Text>
          ))}
        </Section>
      )}
      {props.calendar && props.kind !== "release" && (
        <Text style={{ ...muted, margin: "24px 0 0" }}>
          Добавьте дату старта в календарь:{" "}
          <Link href={props.calendar.icsUrl} style={linkStyle}>
            iPhone, Android, Outlook
          </Link>{" "}
          ·{" "}
          <Link href={props.calendar.googleUrl} style={linkStyle}>
            Google Календарь
          </Link>
        </Text>
      )}
      {props.telegramUrl && (
        <Text style={{ ...muted, margin: "12px 0 0" }}>
          Удобнее в мессенджере?{" "}
          <Link href={props.telegramUrl} style={linkStyle}>
            Получать напоминания в Telegram
          </Link>
        </Text>
      )}
    </StarivaLayout>
  );
}
