"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useId, useState } from "react";
import {
  ConsentCheckbox,
  OfferAcceptanceNote,
  PD_CONSENT_ERROR,
  PersonalDataConsentLabel,
} from "@/components/stariva/consent-checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/lib/auth/client";
import { suggestEmailFix } from "@/lib/email-typo";
import { formatPrice } from "@/lib/workshops-data";

interface WorkshopPurchaseProps {
  slug: string;
  price: number;
  title: string;
  /** Куда вернуть после входа по ссылке «Уже покупали?». */
  returnPath?: string;
  /** Подпись кнопки оплаты вместо «Купить за …». */
  buyLabel?: string;
  onBuyClick?: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_DRAFT_KEY = "stariva:workshop-email";

function readEmailDraft(): string {
  try {
    return window.sessionStorage.getItem(EMAIL_DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveEmailDraft(email: string) {
  try {
    window.sessionStorage.setItem(EMAIL_DRAFT_KEY, email);
  } catch {
    // Хранилище недоступно — просто не запоминаем
  }
}

type Notice = { tone: "error" | "info"; text: string } | null;

/**
 * Покупка мастер-класса. Гостю не нужна регистрация: достаточно email — на
 * него придут доступ и напоминания, а аккаунт заведётся сам.
 */
export function WorkshopPurchase({
  slug,
  price,
  title,
  returnPath = `/workshops/${slug}`,
  buyLabel,
  onBuyClick,
}: WorkshopPurchaseProps) {
  const { data: session, isPending: sessionPending } = useSession();
  const [owned, setOwned] = useState<boolean | null>(null);
  const [buying, setBuying] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [emailError, setEmailError] = useState<string>();
  const [consentError, setConsentError] = useState<string>();
  const [notice, setNotice] = useState<Notice>(null);
  const ids = useId();
  const emailId = `${ids}-email`;

  useEffect(() => {
    setEmail((current) => current || readEmailDraft());
  }, []);

  // Проверяем наличие доступа у авторизованного пользователя
  useEffect(() => {
    let active = true;
    if (!session) {
      setOwned(false);
      return;
    }
    fetch(`/api/account/access?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setOwned(Boolean(d.owned));
      })
      .catch(() => {
        if (active) setOwned(false);
      });
    return () => {
      active = false;
    };
  }, [session, slug]);

  const suggestion = !session && email ? suggestEmailFix(email) : null;

  function validate(): boolean {
    if (session) return true;
    const emailOk = EMAIL_PATTERN.test(email.trim());
    setEmailError(emailOk ? undefined : "Введите email, например olga@mail.ru");
    setConsentError(consent ? undefined : PD_CONSENT_ERROR);
    if (!emailOk) document.getElementById(emailId)?.focus();
    return emailOk && consent;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    if (!validate()) return;

    onBuyClick?.();
    setBuying(true);
    const guestEmail = email.trim().toLowerCase();
    if (!session) saveEmailDraft(guestEmail);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          session
            ? { slug }
            : { slug, email: guestEmail, personalDataConsent: consent },
        ),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data.alreadyOwned) {
        if (session) {
          setOwned(true);
        } else {
          setNotice({ tone: "info", text: data.error });
        }
        setBuying(false);
        return;
      }
      if (!res.ok) {
        setNotice({
          tone: "error",
          text:
            data.error || "Не удалось перейти к оплате. Попробуйте ещё раз.",
        });
        setBuying(false);
        return;
      }
      // Бесплатный мастер-класс — доступ уже выдан
      if (data.free) {
        if (session) {
          window.location.href = `/account/workshops/${slug}`;
          return;
        }
        setNotice({
          tone: "info",
          text: `Доступ открыт! Ссылка для входа отправлена на ${guestEmail}.`,
        });
        setBuying(false);
        return;
      }
      if (!data.confirmationUrl) {
        setNotice({ tone: "error", text: "Не удалось перейти к оплате" });
        setBuying(false);
        return;
      }
      // Редирект на страницу оплаты YooKassa
      window.location.href = data.confirmationUrl;
    } catch {
      setNotice({
        tone: "error",
        text: "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.",
      });
      setBuying(false);
    }
  }

  if (sessionPending || (session && owned === null)) {
    return (
      <div className="flex items-center justify-center w-full py-4 mb-3">
        <Spinner className="text-taupe" />
      </div>
    );
  }

  // Доступ уже есть — ведём в кабинет
  if (owned) {
    return (
      <Button
        asChild
        className="w-full bg-espresso text-parchment hover:bg-espresso/90 py-6 rounded-2xl mb-3 text-base"
      >
        <Link href={`/account/workshops/${slug}`}>Смотреть в кабинете</Link>
      </Button>
    );
  }

  const submitLabel =
    price === 0
      ? "Смотреть бесплатно"
      : (buyLabel ?? `Купить за ${formatPrice(price)}`);

  return (
    <form onSubmit={handleSubmit} noValidate className="mb-3">
      {session ? (
        <p className="text-sm text-text-grey mb-4">
          Доступ откроется в кабинете{" "}
          <span className="text-espresso">{session.user.email}</span>
        </p>
      ) : (
        <div className="mb-4 space-y-3">
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
              disabled={buying}
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
                Может быть,{" "}
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
              Без регистрации и пароля: пришлём ссылку на уроки и напомним о
              старте.
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
        </div>
      )}

      <Button
        type="submit"
        disabled={buying}
        aria-busy={buying || undefined}
        className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark py-6 rounded-2xl text-base"
        aria-label={
          price === 0
            ? `Смотреть бесплатно: ${title}`
            : `${submitLabel}: мастер-класс «${title}»`
        }
      >
        {buying ? (
          <>
            <Spinner className="mr-2" />
            Переходим к оплате…
          </>
        ) : (
          submitLabel
        )}
      </Button>

      <div aria-live="polite">
        {notice ? (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className={
              notice.tone === "error"
                ? "mt-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
                : "mt-3 rounded-xl bg-sage/15 px-4 py-3 text-sm text-espresso"
            }
          >
            {notice.text}
          </p>
        ) : null}
      </div>

      {price > 0 ? <OfferAcceptanceNote className="mt-3" /> : null}
      {!session ? (
        <p className="mt-2 text-center text-[12px] text-taupe">
          Уже покупали?{" "}
          <Link
            href={`/sign-in?callbackURL=${encodeURIComponent(returnPath)}`}
            className="text-terracotta underline-offset-2 hover:underline"
          >
            Войти
          </Link>
        </p>
      ) : null}
    </form>
  );
}
