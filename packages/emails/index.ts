import OtpSignInEmail from "./emails/otp-sign-in";
import ResetPasswordEmail from "./emails/reset-password";
import StarivaChangeEmailEmail from "./emails/stariva-change-email";
import StarivaMagicLinkEmail from "./emails/stariva-magic-link";
import StarivaOrderEmail from "./emails/stariva-order";
import StarivaReceiptEmail from "./emails/stariva-receipt";
import StarivaResetPasswordEmail from "./emails/stariva-reset-password";
import StarivaSignInCodeEmail from "./emails/stariva-sign-in-code";
import StarivaVerifyEmail from "./emails/stariva-verify-email";
import StarivaWorkshopEmail from "./emails/stariva-workshop";
import StarivaWorkshopBriefEmail from "./emails/stariva-workshop-brief";
import StarivaWorkshopUnpaidEmail from "./emails/stariva-workshop-unpaid";
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
export {
  type StarivaWorkshopUnpaidEmailProps,
  workshopUnpaidEmailSubject,
} from "./emails/stariva-workshop-unpaid";
export {
  type StarivaSignInCodeEmailProps,
  signInCodeSubject,
} from "./emails/stariva-sign-in-code";
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
  StarivaSignInCodeEmail,
  StarivaVerifyEmail,
  StarivaWorkshopBriefEmail,
  StarivaWorkshopEmail,
  StarivaWorkshopUnpaidEmail,
  WelcomeEmail,
};
