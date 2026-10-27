"use client";

import { type FormEvent, useId, useState } from "react";
import { CodeInput } from "@/components/stariva/code-input";
import {
  ConsentCheckbox,
  PD_CONSENT_ERROR,
  PersonalDataConsentLabel,
} from "@/components/stariva/consent-checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/lib/auth/client";
import { suggestEmailFix } from "@/lib/email-typo";
import { SentNotice } from "../sent-notice";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_DIGITS = 6;

type Notice = { tone: "error" | "info"; text: string } | null;

export function CodeForm() {
  const { data: session, isPending: sessionPending } = useSession();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [codeError, setCodeError] = useState<string>();
  const [emailError, setEmailError] = useState<string>();
  const [consentError, setConsentError] = useState<string>();
  const [notice, setNotice] = useState<Notice>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ email: string; title: string } | null>(
    null,
  );
  const ids = useId();
  const codeId = `${ids}-code`;
  const emailId = `${ids}-email`;

  const suggestion = !session && email ? suggestEmailFix(email) : null;

  function validate(): boolean {
    const codeOk = code.length === CODE_DIGITS;
    setCodeError(codeOk ? undefined : "В коде 6 цифр, например 482 719");
    if (session) {
      if (!codeOk) document.getElementById(codeId)?.focus();
      return codeOk;
    }
    const emailOk = EMAIL_PATTERN.test(email.trim());
    setEmailError(emailOk ? undefined : "Введите email, например olga@mail.ru");
    setConsentError(consent ? undefined : PD_CONSENT_ERROR);
    if (!codeOk) document.getElementById(codeId)?.focus();
    else if (!emailOk) document.getElementById(emailId)?.focus();
    return codeOk && emailOk && consent;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    if (!validate()) return;

    setSending(true);
    const guestEmail = email.trim().toLowerCase();
    try {
      const res = await fetch("/api/workshops/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          session
            ? { code }
            : { code, email: guestEmail, personalDataConsent: consent },
        ),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.coursePath) {
        window.location.href = data.coursePath;
        return;
      }
      if (res.ok) {
        setSent({ email: data.email ?? guestEmail, title: data.title ?? "" });
        setSending(false);
        return;
      }
      if (res.status === 409 && data.alreadyOwned && data.coursePath) {
        window.location.href = data.coursePath;
        return;
      }
      setNotice({
        tone: res.status === 409 ? "info" : "error",
        text: data.error || "Не удалось проверить код. Попробуйте ещё раз.",
      });
      setSending(false);
    } catch {
      setNotice({
        tone: "error",
        text: "Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте ещё раз.",
      });
      setSending(false);
    }
  }

  if (sent) {
    return (
      <SentNotice
        title="Мастер-класс открыт"
        email={sent.email}
        hint="Письмо не пришло за пару минут? Загляните в «Спам» и «Промоакции». Код уже активирован — вводить его ещё раз не нужно."
      >
        {sent.title ? `«${sent.title}» ждёт вас. ` : ""}Мы отправили на эту
        почту ссылку на уроки — откройте её, чтобы начать смотреть.
      </SentNotice>
    );
  }

  if (sessionPending) {
    return (
      <div className="flex items-center justify-center w-full py-6">
        <Spinner className="text-taupe" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor={codeId} className="block text-sm text-espresso mb-1.5">
          Код из сообщения
        </label>
        <CodeInput
          id={codeId}
          autoFocus
          value={code}
          onChange={(value) => {
            setCode(value);
            if (codeError) setCodeError(undefined);
          }}
          disabled={sending}
          errorId={codeError ? `${codeId}-error` : undefined}
        />
        {codeError ? (
          <p
            id={`${codeId}-error`}
            className="text-[13px] text-destructive mt-1.5"
          >
            {codeError}
          </p>
        ) : null}
      </div>

      {session ? (
        <p className="text-sm text-text-grey">
          Мастер-класс появится в вашем кабинете{" "}
          <span className="text-espresso">({session.user.email})</span>
        </p>
      ) : (
        <>
          <div>
            <label
              htmlFor={emailId}
              className="block text-sm text-espresso mb-1.5"
            >
              Email для доступа к урокам
            </label>
            <Input
              id={emailId}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="olga@mail.ru"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) setEmailError(undefined);
              }}
              disabled={sending}
              required
              aria-invalid={emailError ? true : undefined}
              aria-describedby={`${emailId}-hint${emailError ? ` ${emailId}-error` : ""}`}
              className="h-13 rounded-xl bg-parchment text-base"
            />
            {emailError ? (
              <p
                id={`${emailId}-error`}
                className="text-[13px] text-destructive mt-1.5"
              >
                {emailError}
              </p>
            ) : null}
            {suggestion ? (
              <p className="text-[13px] text-taupe mt-1.5">
                Возможно, вы имели в виду{" "}
                <button
                  type="button"
                  onClick={() => setEmail(suggestion)}
                  className="text-terracotta underline underline-offset-2"
                >
                  {suggestion}
                </button>
                ?
              </p>
            ) : null}
            <p id={`${emailId}-hint`} className="text-[13px] text-taupe mt-1.5">
              Без регистрации и пароля: пришлём ссылку на уроки на этот email.
            </p>
          </div>
          <ConsentCheckbox
            checked={consent}
            onCheckedChange={(value) => {
              setConsent(value);
              if (value) setConsentError(undefined);
            }}
            error={consentError}
          >
            <PersonalDataConsentLabel />
          </ConsentCheckbox>
        </>
      )}

      <Button
        type="submit"
        disabled={sending}
        aria-busy={sending || undefined}
        className="w-full h-auto min-h-12 bg-terracotta text-parchment hover:bg-terracotta-dark py-3 rounded-2xl text-base"
      >
        {sending ? (
          <>
            <Spinner className="mr-2" />
            Проверяем код…
          </>
        ) : (
          "Открыть мастер-класс"
        )}
      </Button>

      <div aria-live="polite">
        {notice ? (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className={
              notice.tone === "error"
                ? "rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
                : "rounded-xl bg-sage/15 px-4 py-3 text-sm text-espresso"
            }
          >
            {notice.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
