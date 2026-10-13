import StarivaOrderEmail from "./emails/stariva-order";
import { buildOrderStatusEmail, type OrderEmailInput } from "./order-email";
import { sendEmail } from "./send";

/**
 * Пишет покупателю о текущем статусе заказа. false — письмо не положено
 * (см. buildOrderStatusEmail). Ошибку отправки пробрасывает.
 */
export async function sendOrderStatusEmail(
  input: OrderEmailInput,
): Promise<boolean> {
  const email = buildOrderStatusEmail(input);
  if (!email) return false;
  const { props, ...envelope } = email;
  await sendEmail({ ...envelope, react: StarivaOrderEmail(props) });
  return true;
}
