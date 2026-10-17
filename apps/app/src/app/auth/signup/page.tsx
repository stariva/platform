import { paths } from "@stariva/config";
import { redirect } from "next/navigation";

/** Регистрации в админке нет: аккаунты администраторов уже есть в базе. */
export default function SignUpPage() {
  redirect(paths.auth.login);
}
