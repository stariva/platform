import StarivaReceiptEmail, {
  receiptEmailSubject,
  type StarivaReceiptEmailProps,
} from "./emails/stariva-receipt";
import { sendEmail } from "./send";

/**
 * Отправляет покупателю чек НПД. Ошибку отправки пробрасывает: мастер
 * отправляет чек вручную и должна увидеть, что письмо не ушло.
 */
export async function sendReceiptEmail({
  to,
  ...props
}: StarivaReceiptEmailProps & { to: string }): Promise<void> {
  await sendEmail({
    to: [to],
    subject: receiptEmailSubject(props),
    react: StarivaReceiptEmail(props),
  });
}
