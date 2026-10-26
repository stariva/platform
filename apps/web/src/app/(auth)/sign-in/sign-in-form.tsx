"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";
import { CodeInput } from "@/components/stariva/code-input";
import {
  ConsentCheckbox,
  PD_CONSENT_ERROR,
  PersonalDataConsentLabel,
} from "@/components/stariva/consent-checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { authClient, signIn } from "@/lib/auth/client";
import {
  PROFILE_REQUIRED,
  SIGN_IN_CALLBACK_HEADER,
  SIGN_IN_CODE_LENGTH,
  SIGN_IN_CODE_TTL_MINUTES,
} from "@/lib/auth/sign-in-shared";
import { useFormToken } from "@/lib/auth/use-form-token";
import { safeCallbackPath } from "@/lib/auth/verification-link";
import { suggestEmailFix } from "@/lib/email-typo";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Повторно отправить код — не раньше, чем через минуту (как antispam). */
const RESEND_SECONDS = 60;

type Step = "email" | "code" | "profile" | "password";
type Notice = { tone: "error" | "info"; text: string } | null;

const primaryButton =
  "w-full h-auto min-h-12 bg-terracotta text-parchment hover:bg-terracotta-dark py-3 rounded-2xl text-base";
const textButton =
  "text-sm text-taupe underline underline-offset-4 decoration-espresso/25 hover:text-espresso hover:decoration-espresso";

/**
 * Вход и регистрация в одной форме: email → код из письма → кабинет. Для
 * адреса без аккаунта после кода спрашиваем имя и согласие на обработку ПДн.
 * Пароль — запасной путь для тех, кто его задал.
 */
export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Только путь на нашем сайте: после входа браузер уходит по этому адресу
  const callbackURL = safeCallbackPath(searchParams.get("callbackURL"));
  const formTokenOptions = useFormToken();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  const [consentError, setConsentError] = useState<string>();
  const [notice, setNotice] = useState<Notice>(
    searchParams.has("error")
      ? {
          tone: "info",
          text: "Ссылка для входа устарела или уже использована. Введите email — пришлём код.",
        }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const ids = useId();
  const emailId = `${ids}-email`;
  const codeId = `${ids}-code`;
  const nameId = `${ids}-name`;
  const passwordId = `${ids}-password`;
  const errorId = `${ids}-error`;

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const address = email.trim().toLowerCase();
  const suggestion =
    step === "email" || step === "password" ? suggestEmailFix(email) : null;

  function go(next: Step) {
    setStep(next);
    setEmailError(undefined);
    setPasswordError(undefined);
    setFieldError(undefined);
    setConsentError(undefined);
    setNotice(null);
  }

  function finish(text: string) {
    setNotice({ tone: "info", text });
    router.push(callbackURL);
    router.refresh();
  }

  function checkEmail(): boolean {
    if (EMAIL_PATTERN.test(address)) return true;
    setEmailError("Введите email, например olga@mail.ru");
    document.getElementById(emailId)?.focus();
    return false;
  }

  async function sendCode() {
    setBusy(true);
    setNotice(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: address,
      type: "sign-in",
      fetchOptions: {
        headers: {
          ...formTokenOptions().headers,
          [SIGN_IN_CALLBACK_HEADER]: callbackURL,
        },
      },
    });
    setBusy(false);
    if (error) {
      setNotice({
        tone: "error",
        text: error.message || "Не удалось отправить код. Попробуйте ещё раз.",
      });
      return false;
    }
    setCode("");
    setEmailError(undefined);
    setFieldError(undefined);
    setResendIn(RESEND_SECONDS);
    return true;
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setEmailError(undefined);
    if (!checkEmail()) return;
    if (await sendCode()) setStep("code");
  }

  async function resend() {
    if (await sendCode()) {
      setStep("code");
      setNotice({
        tone: "info",
        text: "Отправили новый код. Старый больше не действует.",
      });
    }
  }

  /** Код устарел или попытки кончились — нужен новый. */
  function codeExhausted(text: string) {
    setCode("");
    setStep("code");
    setResendIn(0);
    setNotice({ tone: "error", text });
  }

  async function submitCode(otp: string) {
    if (busy) return;
    if (otp.length !== SIGN_IN_CODE_LENGTH) {
      setFieldError("В коде 6 цифр");
      return;
    }
    setBusy(true);
    setFieldError(undefined);
    setNotice(null);
    // Новый код после устаревшего: имя и согласие уже есть — сразу создаём
    const profile =
      consent && name.trim()
        ? { name: name.trim(), personalDataConsent: true }
        : {};
    const { error } = await signIn.emailOtp({
      email: address,
      otp,
      ...profile,
    });
    if (!error) return finish("Входим…");
    setBusy(false);
    if (error.code === PROFILE_REQUIRED) {
      go("profile");
      return;
    }
    if (error.code === "OTP_EXPIRED" || error.code === "TOO_MANY_ATTEMPTS") {
      codeExhausted(
        error.message || "Код больше не действует. Запросите новый.",
      );
      return;
    }
    setCode("");
    setFieldError(
      error.code === "INVALID_OTP"
        ? "Неверный код. Сверьте цифры с последним письмом."
        : error.message || "Не удалось проверить код. Попробуйте ещё раз.",
    );
    document.getElementById(codeId)?.focus();
  }

  async function submitProfile(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    setFieldError(trimmed ? undefined : "Как к вам обращаться?");
    setConsentError(consent ? undefined : PD_CONSENT_ERROR);
    if (!trimmed) document.getElementById(nameId)?.focus();
    if (!trimmed || !consent) return;

    setBusy(true);
    setNotice(null);
    const { error } = await signIn.emailOtp({
      email: address,
      otp: code,
      name: trimmed,
      personalDataConsent: true,
    });
    if (!error) return finish("Кабинет создан. Открываем…");
    setBusy(false);
    if (
      error.code === "OTP_EXPIRED" ||
      error.code === "TOO_MANY_ATTEMPTS" ||
      error.code === "INVALID_OTP"
    ) {
      codeExhausted(
        "Код из письма устарел. Отправьте новый — имя и согласие мы запомнили.",
      );
      return;
    }
    setNotice({
      tone: "error",
      text: error.message || "Не удалось создать кабинет. Попробуйте ещё раз.",
    });
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setEmailError(undefined);
    setPasswordError(undefined);
    if (!checkEmail()) return;
    if (!password) {
      setPasswordError("Введите пароль");
      document.getElementById(passwordId)?.focus();
      return;
    }
    setBusy(true);
    setNotice(null);
    const { error } = await signIn.email({
      email: address,
      password,
      callbackURL,
    });
    if (!error) return finish("С возвращением!");
    setBusy(false);
    setNotice({
      tone: "error",
      text:
        error.status === 403
          ? "Email ещё не подтверждён. Войдите по коду из письма — это и подтвердит почту."
          : error.message || "Неверный email или пароль",
    });
  }

  const noticeBlock = (
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
  );

  const errorText = fieldError ? (
    <p id={errorId} className="text-[13px] text-destructive mt-1.5">
      {fieldError}
    </p>
  ) : null;

  const emailField = (
    <div>
      <label htmlFor={emailId} className="block text-sm text-espresso mb-1.5">
        Email
      </label>
      <Input
        id={emailId}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        placeholder="olga@mail.ru"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (emailError) setEmailError(undefined);
        }}
        disabled={busy}
        required
        aria-invalid={emailError ? true : undefined}
        aria-describedby={emailError ? `${emailId}-error` : undefined}
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
    </div>
  );

  if (step === "code") {
    return (
      <div className="space-y-4">
        <StepIntro>
          Отправили код на{" "}
          <span className="font-medium text-espresso">{address}</span>.{" "}
          <button
            type="button"
            onClick={() => go("email")}
            className={textButton}
          >
            Изменить
          </button>
        </StepIntro>
        <div>
          <label
            htmlFor={codeId}
            className="block text-sm text-espresso mb-1.5"
          >
            Код из письма
          </label>
          <CodeInput
            id={codeId}
            autoFocus
            autoComplete="one-time-code"
            value={code}
            onChange={(value) => {
              setCode(value);
              if (fieldError) setFieldError(undefined);
            }}
            onComplete={submitCode}
            disabled={busy}
            errorId={fieldError ? errorId : undefined}
          />
          {errorText}
        </div>
        <Button
          type="button"
          onClick={() => submitCode(code)}
          disabled={busy}
          aria-busy={busy || undefined}
          className={primaryButton}
        >
          {busy ? (
            <>
              <Spinner className="mr-2" />
              Проверяем код…
            </>
          ) : (
            "Войти"
          )}
        </Button>
        {noticeBlock}
        <p className="rounded-xl bg-sand/70 px-4 py-3 text-sm leading-relaxed text-taupe">
          Код действует {SIGN_IN_CODE_TTL_MINUTES} минут. Читаете почту на этом
          же устройстве — можно просто нажать кнопку в письме. Письма нет?
          Загляните в «Спам» и «Промоакции».
        </p>
        <div className="text-center">
          {resendIn > 0 ? (
            <span className="text-sm text-taupe">
              Отправить код ещё раз можно через {resendIn} с
            </span>
          ) : (
            <button
              type="button"
              onClick={resend}
              disabled={busy}
              className={textButton}
            >
              Отправить код ещё раз
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === "profile") {
    return (
      <form onSubmit={submitProfile} noValidate className="space-y-4">
        <StepIntro>
          Почта <span className="font-medium text-espresso">{address}</span>{" "}
          подтверждена. Это ваш первый вход — осталось познакомиться.
        </StepIntro>
        <div>
          <label
            htmlFor={nameId}
            className="block text-sm text-espresso mb-1.5"
          >
            Как к вам обращаться
          </label>
          <Input
            id={nameId}
            type="text"
            autoComplete="name"
            autoFocus
            placeholder="Ольга"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (fieldError) setFieldError(undefined);
            }}
            disabled={busy}
            required
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? errorId : undefined}
            className="h-13 rounded-xl bg-parchment text-base"
          />
          {errorText}
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
        <Button
          type="submit"
          disabled={busy}
          aria-busy={busy || undefined}
          className={primaryButton}
        >
          {busy ? (
            <>
              <Spinner className="mr-2" />
              Создаём кабинет…
            </>
          ) : (
            "Создать кабинет"
          )}
        </Button>
        {noticeBlock}
        <p className="text-xs text-taupe leading-relaxed text-center">
          Создавая кабинет, вы принимаете условия{" "}
          <a href="/offer" className="text-terracotta hover:underline">
            публичной оферты
          </a>
          .
        </p>
      </form>
    );
  }

  if (step === "password") {
    return (
      <form onSubmit={submitPassword} noValidate className="space-y-4">
        {emailField}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor={passwordId} className="block text-sm text-espresso">
              Пароль
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-terracotta hover:underline"
            >
              Забыли пароль?
            </Link>
          </div>
          <PasswordInput
            id={passwordId}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (passwordError) setPasswordError(undefined);
            }}
            disabled={busy}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? `${passwordId}-error` : undefined}
            className="h-13 rounded-xl bg-parchment text-base"
          />
          {passwordError ? (
            <p
              id={`${passwordId}-error`}
              className="text-[13px] text-destructive mt-1.5"
            >
              {passwordError}
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          disabled={busy}
          aria-busy={busy || undefined}
          className={primaryButton}
        >
          {busy ? (
            <>
              <Spinner className="mr-2" />
              Входим…
            </>
          ) : (
            "Войти"
          )}
        </Button>
        {noticeBlock}
        <div className="text-center">
          <button
            type="button"
            onClick={() => go("email")}
            className={textButton}
          >
            Войти по коду из письма
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitEmail} noValidate className="space-y-4">
      {emailField}
      <Button
        type="submit"
        disabled={busy}
        aria-busy={busy || undefined}
        className={primaryButton}
      >
        {busy ? (
          <>
            <Spinner className="mr-2" />
            Отправляем код…
          </>
        ) : (
          "Получить код"
        )}
      </Button>
      {noticeBlock}
      <p className="text-[13px] text-taupe leading-relaxed text-center">
        Впервые у нас? Кабинет создадим сразу после кода.
      </p>
      <div className="text-center">
        <button
          type="button"
          onClick={() => go("password")}
          className={textButton}
        >
          Войти с паролем
        </button>
      </div>
    </form>
  );
}

function StepIntro({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-taupe">{children}</p>;
}
