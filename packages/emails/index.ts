import OtpSignInEmail from "./emails/otp-sign-in";
import ResetPasswordEmail from "./emails/reset-password";
import StarivaChangeEmailEmail from "./emails/stariva-change-email";
import StarivaMagicLinkEmail from "./emails/stariva-magic-link";
import StarivaResetPasswordEmail from "./emails/stariva-reset-password";
import StarivaVerifyEmail from "./emails/stariva-verify-email";
import WelcomeEmail from "./emails/welcome";

export { sendEmail, sendEmailHtml } from "./send";
export {
  OtpSignInEmail,
  ResetPasswordEmail,
  StarivaChangeEmailEmail,
  StarivaMagicLinkEmail,
  StarivaResetPasswordEmail,
  StarivaVerifyEmail,
  WelcomeEmail,
};
