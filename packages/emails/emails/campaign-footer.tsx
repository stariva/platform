import { Img, Link, Text } from "@react-email/components";
import { colors } from "./stariva-layout";

/** Ссылки письма рассылки, которые шаблон получает от отправки. */
export interface CampaignEmailLinks {
  /** Почему пришло письмо: «вы купили мастер-класс на stariva.ru». */
  reason: string;
  unsubscribeUrl: string;
  /** Картинка-пиксель: по ней видно, что письмо открыли. */
  openPixelUrl?: string;
}

/** Низ любого письма рассылки: отписка и пиксель открытия. */
export function CampaignFooter({
  unsubscribeUrl,
  openPixelUrl,
}: Omit<CampaignEmailLinks, "reason">) {
  return (
    <>
      <Text
        style={{
          margin: "12px 0 0",
          fontSize: 12,
          lineHeight: "19px",
          color: colors.textGrey,
        }}
      >
        Если не хотите получать такие письма, можно{" "}
        <Link href={unsubscribeUrl} style={{ color: colors.darkGrey }}>
          отписаться
        </Link>
        .
      </Text>
      {openPixelUrl && (
        <Img
          src={openPixelUrl}
          width="1"
          height="1"
          alt=""
          style={{ display: "block", width: 1, height: 1, border: 0 }}
        />
      )}
    </>
  );
}
