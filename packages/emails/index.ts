import OtpSignInEmail from "./emails/otp-sign-in";
import ResetPasswordEmail from "./emails/reset-password";
import StarivaChangeEmailEmail from "./emails/stariva-change-email";
import StarivaMagicLinkEmail from "./emails/stariva-magic-link";
import StarivaOrderEmail from "./emails/stariva-order";
import StarivaReceiptEmail from "./emails/stariva-receipt";
import StarivaResetPasswordEmail from "./emails/stariva-reset-password";
import StarivaVerifyEmail from "./emails/stariva-verify-email";
import StarivaWorkshopEmail from "./emails/stariva-workshop";
import StarivaWorkshopBriefEmail from "./emails/stariva-workshop-brief";
import WelcomeEmail from "./emails/welcome";

export { sendWorkshopBriefEmail, type WorkshopBriefFile } from "./brief";
export {
  isOrderEmailStatus,
  ORDER_EMAIL_STATUSES,
  type OrderEmailItem,
  type OrderEmailStatus,
  type StarivaOrderEmailProps,
} from "./emails/stariva-order";
export type {
  StarivaWorkshopEmailProps,
  WorkshopEmailKind,
} from "./emails/stariva-workshop";
export { sendOrderStatusEmail } from "./order";
export type { OrderEmailOrder } from "./order-email";
export { sendReceiptEmail } from "./receipt";
export { type EmailAttachment, sendEmail, sendEmailHtml } from "./send";
export {
  OtpSignInEmail,
  ResetPasswordEmail,
  StarivaChangeEmailEmail,
  StarivaMagicLinkEmail,
  StarivaOrderEmail,
  StarivaReceiptEmail,
  StarivaResetPasswordEmail,
  StarivaVerifyEmail,
  StarivaWorkshopBriefEmail,
  StarivaWorkshopEmail,
  WelcomeEmail,
};
