import { type FormEvent, useEffect, useId, useState } from "react";
import { API_URL } from "@/lib/api";
import { authClient, signedIn } from "@/lib/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LENGTH = 6;
/** Повторный код — не раньше чем через минуту (так же на сервере). */
const RESEND_SECONDS = 60;

type Step = "email" | "code";

const primaryButton =
  "min-h-12 w-full rounded-[var(--radius-md)] bg-accent font-semibold text-accent-fg disabled:opacity-60";
const textButton = "min-h-12 text-sm text-muted underline underline-offset-4";
const inputClass =
  "min-h-12 w-full rounded-[var(--radius-md)] bg-surface px-4 text-base ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-accent";

/**
 * Вход в аккаунт сайта: почта → код из письма. Тот же аккаунт, что и на
 * stariva.ru: купленные курсы появляются в приложении сами. Регистрации здесь
 * нет — кабинет создают на сайте.
 */
export function LoginScreen() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [resendIn, setResendIn] = useState(0);

  const ids = useId();
  const emailId = `${ids}-email`;
  const codeId = `${ids}-code`;
  const address = email.trim().toLowerCase();

  // Токен формы берём заранее: сервер не принимает его моложе 2 секунд
  useEffect(() => {
    void authClient.prepareFormToken().catch(() => {});
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendCode(): Promise<boolean> {
    setBusy(true);
    setError(undefined);
    setInfo(undefined);
    const result = await authClient.requestCode(address);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    setCode("");
    setResendIn(RESEND_SECONDS);
    return true;
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!EMAIL_PATTERN.test(address)) {
      setError("Введите email, например olga@mail.ru");
      return;
    }
    if (await sendCode()) setStep("code");
  }

  async function submitCode(value: string) {
    if (busy) return;
    if (value.length !== CODE_LENGTH) {
      setError(`В коде ${CODE_LENGTH} цифр`);
      return;
    }
    setBusy(true);
    setError(undefined);
    const result = await authClient.signInWithCode(address, value);
    if (result.ok) {
      signedIn(result.user);
      return;
    }
    setBusy(false);
    setCode("");
    setError(result.message);
    document.getElementById(codeId)?.focus();
  }

  async function resend() {
    if (await sendCode())
      setInfo("Отправили новый код. Старый больше не действует.");
  }

  return (
    <div className="min-h-dvh bg-bg px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(7rem,env(safe-area-inset-bottom))] text-fg">
      <span className="text-xs font-bold uppercase tracking-[.25em] text-accent">
        Stariva · ваш мир творчества
      </span>
      <h1 className="display mt-4">
        Творчество
        <br />
        продолжается здесь
      </h1>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
        Войдите в тот же аккаунт, что и на stariva.ru, — купленные мастер-классы
        появятся здесь.
      </p>
      <div className="relative mt-6 h-40 overflow-hidden rounded-[var(--radius-xl)]">
        <img
          src="/images/workshop-tree.png"
          alt="Руки плетут украшение макраме"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/35 to-transparent" />
      </div>

      {step === "email" ? (
        <form onSubmit={submitEmail} noValidate className="mt-7 space-y-4">
          <div>
            <label htmlFor={emailId} className="mb-1.5 block text-sm">
              Email
            </label>
            <input
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
                setError(undefined);
              }}
              disabled={busy}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${ids}-error` : undefined}
              className={inputClass}
            />
          </div>
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy ? "Отправляем код…" : "Получить код"}
          </button>
          <Notice id={`${ids}-error`} error={error} info={info} />
        </form>
      ) : (
        <div className="mt-7 space-y-4">
          <p className="text-sm text-muted">
            Отправили код на{" "}
            <span className="font-medium text-fg">{address}</span>.{" "}
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(undefined);
                setInfo(undefined);
              }}
              className="underline underline-offset-4"
            >
              Изменить
            </button>
          </p>
          <div>
            <label htmlFor={codeId} className="mb-1.5 block text-sm">
              Код из письма
            </label>
            <input
              id={codeId}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              // biome-ignore lint/a11y/noAutofocus: после отправки кода поле одно на экране
              autoFocus
              value={code}
              onChange={(event) => {
                const digits = event.target.value
                  .replace(/\D/g, "")
                  .slice(0, CODE_LENGTH);
                setCode(digits);
                setError(undefined);
                if (digits.length === CODE_LENGTH) void submitCode(digits);
              }}
              disabled={busy}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${ids}-error` : undefined}
              className={`${inputClass} text-center text-2xl tracking-[0.4em] tabular-nums`}
            />
          </div>
          <button
            type="button"
            onClick={() => void submitCode(code)}
            disabled={busy}
            className={primaryButton}
          >
            {busy ? "Проверяем код…" : "Войти"}
          </button>
          <Notice id={`${ids}-error`} error={error} info={info} />
          <p className="rounded-xl bg-surface px-4 py-3 text-sm text-muted ring-1 ring-line">
            Код действует 10 минут. Письма нет? Загляните в «Спам» и
            «Промоакции». Нет аккаунта — создайте его на{" "}
            <a
              href={`${API_URL || "https://stariva.ru"}/sign-in`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              stariva.ru
            </a>
            .
          </p>
          <div className="text-center">
            {resendIn > 0 ? (
              <span className="text-sm text-muted">
                Отправить код ещё раз можно через {resendIn} с
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void resend()}
                disabled={busy}
                className={textButton}
              >
                Отправить код ещё раз
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Notice({
  id,
  error,
  info,
}: {
  id: string;
  error: string | undefined;
  info: string | undefined;
}) {
  return (
    <div aria-live="polite">
      {error ? (
        <p
          id={id}
          role="alert"
          className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : info ? (
        <p role="status" className="rounded-xl bg-sage/15 px-4 py-3 text-sm">
          {info}
        </p>
      ) : null}
    </div>
  );
}
