import StarivaWorkshopEmail from "./emails/stariva-workshop";
import { sendEmail } from "./send";

const moscowDate = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Moscow",
});
const moscowTime = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

/** «1 ноября в 10:00 (мск)» — так же, как в письмах сайта. */
function releaseLabel(releaseAt: Date): string {
  return `${moscowDate.format(releaseAt)} в ${moscowTime.format(releaseAt)} (мск)`;
}

/**
 * Письмо покупателю набора: доступ к урокам открыт, коробку привезёт Ozon.
 * Ту же версию письма сайт отправляет сразу после оплаты; эта функция нужна
 * кнопке в заказе, когда первое письмо не дошло. Если урок ещё не вышел,
 * в письме дата открытия, как в письме сайта. Ошибку отправки пробрасывает:
 * вызывающий решает, повторять ли.
 */
export async function sendKitAccessEmail({
  to,
  idempotencyKey,
  workshopTitle,
  accessUrl,
  releaseAt,
}: {
  to: string;
  idempotencyKey?: string;
  workshopTitle: string;
  accessUrl: string;
  /** Когда откроются уроки; null или прошедшая дата — уже открыты. */
  releaseAt?: Date | null;
}): Promise<void> {
  const upcoming = releaseAt && releaseAt.getTime() > Date.now();
  await sendEmail({
    idempotencyKey,
    to: [to],
    subject: upcoming
      ? `Вы записаны на мастер-класс «${workshopTitle}» — Stariva`
      : `Доступ к мастер-классу «${workshopTitle}» открыт — Stariva`,
    react: StarivaWorkshopEmail({
      kind: "booked",
      kit: true,
      workshopTitle,
      releaseLabel: upcoming ? releaseLabel(releaseAt) : null,
      accessUrl,
      materials: [],
    }),
  });
}
