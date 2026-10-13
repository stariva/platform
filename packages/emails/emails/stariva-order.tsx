import { Section, Text } from "@react-email/components";
import { colors, fonts, labelCaps, StarivaLayout } from "./stariva-layout";

/**
 * Статусы заказа на товары, о которых покупатель узнаёт письмом. Остальные
 * (ожидание оплаты сразу после оформления, сборка в Ozon, возврат заявки на
 * согласование) либо видны покупателю на экране, либо служебные.
 */
export const ORDER_EMAIL_STATUSES = [
  "requested",
  "awaiting_deposit",
  "in_production",
  "awaiting_balance",
  "paid",
  "ready_to_ship",
  "shipped",
  "delivered",
  "declined",
  "canceled",
  "refunded",
] as const;

export type OrderEmailStatus = (typeof ORDER_EMAIL_STATUSES)[number];

export function isOrderEmailStatus(status: string): status is OrderEmailStatus {
  return (ORDER_EMAIL_STATUSES as readonly string[]).includes(status);
}

export interface StarivaOrderEmailProps {
  status: OrderEmailStatus;
  orderNumber: number;
  /** Страница заказа: покупатель подтверждает её телефоном из заказа. */
  orderUrl: string;
  items: { name: string; quantity: number }[];
  /** Суммы в копейках. */
  amountTotal: number;
  depositAmount: number | null;
  /** Срок изготовления, который назвал мастер. */
  leadTime: string | null;
  /** «16 октября» — до какого дня ждём текущую оплату. */
  paymentDueLabel: string | null;
  trackingNumber: string | null;
  declineReason: string | null;
}

const rubles = (kopecks: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kopecks / 100);

function balanceOf(props: StarivaOrderEmailProps) {
  return props.amountTotal - (props.depositAmount ?? 0);
}

function copy(props: StarivaOrderEmailProps) {
  const no = `№${props.orderNumber}`;
  const due = props.paymentDueLabel ? ` до ${props.paymentDueLabel}` : "";
  switch (props.status) {
    case "requested":
      return {
        subject: `Заявка ${no} принята`,
        heading: "Заявка принята",
        intro:
          "Спасибо! Оплачивать пока ничего не нужно: мастер свяжется с вами, чтобы обсудить мерки, цвет, цену и доставку. Мерки и пожелания можно сразу указать на странице заказа.",
        button: "Открыть заказ",
      };
    case "awaiting_deposit":
      return {
        subject: `Заказ ${no} согласован: внесите предоплату`,
        heading: "Заказ согласован",
        intro: `Мастер согласовал ваш заказ. Внесите предоплату ${rubles(props.depositAmount ?? 0)}${due} — и мастер начнёт плести.`,
        button: "Внести предоплату",
      };
    case "in_production":
      return {
        subject: `Предоплата по заказу ${no} получена`,
        heading: "Мастер начал плести",
        intro: `Предоплата получена, спасибо! Мастер плетёт ваше изделие${props.leadTime ? `, срок изготовления — ${props.leadTime}` : ""}. Когда оно будет готово, придёт письмо с доплатой.`,
        button: "Открыть заказ",
      };
    case "awaiting_balance":
      return {
        subject: `Изделие по заказу ${no} готово`,
        heading: "Изделие готово!",
        intro: `Ваше изделие готово. Внесите доплату ${rubles(balanceOf(props))}${due} — и мастер отправит заказ.`,
        button: "Внести доплату",
      };
    case "paid":
      return {
        subject: `Заказ ${no} оплачен`,
        heading: "Спасибо за заказ!",
        intro: `Оплата ${rubles(props.amountTotal)} получена. Заказ собирается и скоро уйдёт в доставку — следить за ним можно на странице заказа.`,
        button: "Открыть заказ",
      };
    case "ready_to_ship":
      return {
        subject: `Заказ ${no} оплачен полностью`,
        heading: "Заказ оплачен",
        intro:
          "Доплата получена, спасибо! Мастер упакует изделие и отправит его. Номер отправления появится на странице заказа.",
        button: "Открыть заказ",
      };
    case "shipped":
      return {
        subject: `Заказ ${no} отправлен`,
        heading: "Заказ в пути",
        intro: props.trackingNumber
          ? "Заказ отправлен. По номеру отправления ниже можно следить за доставкой."
          : "Заказ отправлен. Подробности доставки — на странице заказа.",
        button: "Открыть заказ",
      };
    case "delivered":
      return {
        subject: `Заказ ${no} получен`,
        heading: "Заказ у вас",
        intro:
          "Заказ доставлен. Надеемся, изделие вас порадует! Спасибо, что выбрали Stariva.",
        button: "Открыть заказ",
      };
    case "declined":
      return {
        subject: `Заявка ${no} отклонена`,
        heading: "Заявка отклонена",
        intro:
          "К сожалению, мастер не сможет выполнить эту заявку. Оплата по ней не списывалась.",
        button: "Открыть заказ",
      };
    case "canceled":
      return {
        subject: `Заказ ${no} отменён`,
        heading: "Заказ отменён",
        intro:
          "Заказ отменён. Если вы уже вносили оплату, мастер свяжется с вами, чтобы вернуть деньги.",
        button: "Открыть заказ",
      };
    case "refunded":
      return {
        subject: `Деньги за заказ ${no} возвращены`,
        heading: "Деньги возвращены",
        intro:
          "Деньги за заказ возвращены. Срок зачисления на карту зависит от банка — обычно это несколько дней.",
        button: "Открыть заказ",
      };
  }
}

/** Тема письма о статусе заказа. */
export function orderEmailSubject(props: StarivaOrderEmailProps): string {
  return `${copy(props).subject} — Stariva`;
}

/** Строки «подпись — значение» под вступлением: суммы, сроки, трек-номер. */
function facts(props: StarivaOrderEmailProps): [string, string][] {
  const rows: [string, string][] = [];
  switch (props.status) {
    case "awaiting_deposit":
      rows.push(["Стоимость заказа", rubles(props.amountTotal)]);
      rows.push(["Предоплата", rubles(props.depositAmount ?? 0)]);
      if (props.leadTime) rows.push(["Срок изготовления", props.leadTime]);
      break;
    case "awaiting_balance":
      rows.push(["Стоимость заказа", rubles(props.amountTotal)]);
      rows.push(["Предоплата внесена", rubles(props.depositAmount ?? 0)]);
      rows.push(["К доплате", rubles(balanceOf(props))]);
      break;
    case "shipped":
      if (props.trackingNumber) {
        rows.push(["Номер отправления", props.trackingNumber]);
      }
      break;
    case "declined":
      if (props.declineReason) rows.push(["Причина", props.declineReason]);
      break;
  }
  return rows;
}

const cell = { fontSize: 14, lineHeight: "22px" } as const;

/**
 * Письмо покупателю о смене статуса заказа на товары: что произошло, что
 * делать дальше и ссылка на страницу заказа. Без props показывает
 * демонстрационную заявку для предпросмотра шаблона.
 */
export default function StarivaOrderEmail(
  props: StarivaOrderEmailProps = {
    status: "awaiting_deposit",
    orderNumber: 1042,
    orderUrl: "https://stariva.ru/order/abc",
    items: [{ name: "Ёлка макраме 60 см", quantity: 1 }],
    amountTotal: 640000,
    depositAmount: 300000,
    leadTime: "2–3 недели",
    paymentDueLabel: "16 октября",
    trackingNumber: null,
    declineReason: null,
  },
) {
  const text = copy(props);
  const rows = facts(props);

  return (
    <StarivaLayout
      previewText={text.subject}
      heading={text.heading}
      intro={text.intro}
      buttonLabel={text.button}
      buttonUrl={props.orderUrl}
      footnote="Чтобы открыть заказ, введите телефон, который указали при оформлении. Если остались вопросы, напишите на info@stariva.ru."
    >
      {rows.length > 0 && (
        <Section
          style={{
            marginTop: 32,
            padding: "16px 22px",
            borderRadius: 12,
            background: colors.offWhite,
            border: `1px solid ${colors.lightGrey}`,
          }}
        >
          {rows.map(([label, value]) => (
            <Text key={label} style={{ ...cell, margin: "4px 0" }}>
              <span style={{ color: colors.textGrey }}>{label}: </span>
              <span style={{ color: colors.nearBlack, fontWeight: 500 }}>
                {value}
              </span>
            </Text>
          ))}
        </Section>
      )}
      {props.items.length > 0 && (
        <Section style={{ marginTop: 32 }}>
          <Text style={{ ...labelCaps, margin: "0 0 8px" }}>
            Заказ №{props.orderNumber}
          </Text>
          {props.items.map((item, index) => (
            <Text
              // biome-ignore lint/suspicious/noArrayIndexKey: позиции могут совпадать по названию
              key={index}
              style={{
                ...cell,
                margin: 0,
                padding: "10px 0",
                fontFamily: fonts.sans,
                color: colors.darkGrey,
                borderTop: `1px solid ${colors.lightGrey}`,
              }}
            >
              {item.name}
              {item.quantity > 1 ? ` × ${item.quantity}` : ""}
            </Text>
          ))}
        </Section>
      )}
    </StarivaLayout>
  );
}
