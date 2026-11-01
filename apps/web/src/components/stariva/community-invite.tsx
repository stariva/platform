"use client";

import { useEffect, useState } from "react";
import { reachGoal } from "@/lib/analytics";
import {
  COMMUNITY_LINKS,
  type CommunityChannel,
  markCommunityJoined,
  shouldShowCommunityInvite,
  snoozeCommunityInvite,
  subscribeCommunityInvite,
} from "@/lib/community";
import { cn } from "@/lib/utils";
import { MaxIcon, TelegramIcon } from "./icons";

const CHANNELS = {
  telegram: { label: "Telegram", Icon: TelegramIcon },
  max: { label: "MAX", Icon: MaxIcon },
} satisfies Record<CommunityChannel, unknown>;

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3 3l10 10M13 3L3 13"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Ссылки на группы сообщества; клик — цель в Метрику и больше без карточки. */
export function CommunityLinks({
  source,
  labelPrefix = "",
  className,
  linkClassName,
  iconClassName,
}: {
  /** Где стоит приглашение — для аналитики («footer», «blog»…). */
  source: string;
  /** Текст перед названием мессенджера: «Группа в » → «Группа в Telegram». */
  labelPrefix?: string;
  className?: string;
  linkClassName?: string;
  iconClassName?: string;
}) {
  if (COMMUNITY_LINKS.length === 0) return null;
  return (
    <span className={className}>
      {COMMUNITY_LINKS.map(({ channel, href }) => {
        const { label, Icon } = CHANNELS[channel];
        return (
          <a
            key={channel}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              markCommunityJoined();
              reachGoal("community_join", { channel, source });
            }}
            className={linkClassName}
          >
            <Icon className={iconClassName} />
            {labelPrefix}
            {label}
          </a>
        );
      })}
    </span>
  );
}

/**
 * Карточка-приглашение в сообщество внутри страницы — без всплывающих окон.
 * Не показывается тем, кто уже перешёл в группу, и на 60 дней после
 * «Не сейчас». До проверки хранилища ничего не рисует, чтобы не мигать.
 */
export function CommunityInvite({
  source,
  title = "Плетём вместе",
  text = "Stariva Community — группы для тех, кто любит макраме. Процесс плетения и новые изделия, мастер-классы, ответы на вопросы и работы участниц. Выберите удобный мессенджер.",
  className,
}: {
  source: string;
  title?: string;
  text?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(shouldShowCommunityInvite());
    const unsubscribe = subscribeCommunityInvite(updateVisibility);
    updateVisibility();
    return unsubscribe;
  }, []);

  if (!visible) return null;

  return (
    <aside
      aria-label="Сообщество Stariva"
      className={cn(
        "relative rounded-2xl border border-espresso/10 bg-sand/60 p-5 pr-12 sm:p-6 sm:pr-14 animate-in fade-in duration-200",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => {
          snoozeCommunityInvite();
          setVisible(false);
          reachGoal("community_invite_dismiss", { source });
        }}
        aria-label="Не сейчас"
        title="Не сейчас"
        className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full text-espresso/50 hover:bg-espresso/5 hover:text-espresso transition-colors"
      >
        <CloseIcon className="size-3.5" />
      </button>
      <p className="label-caps text-terracotta mb-2">Stariva Community</p>
      <h2 className="font-serif text-xl text-espresso mb-1.5">{title}</h2>
      <p className="text-sm leading-relaxed text-dark-grey mb-4">{text}</p>
      <CommunityLinks
        source={source}
        className="flex flex-wrap gap-2"
        linkClassName="inline-flex items-center gap-2 rounded-full border border-espresso/15 bg-white px-4 py-2.5 text-sm text-espresso hover:border-espresso/40 transition-colors"
        iconClassName="size-4 shrink-0 text-terracotta"
      />
    </aside>
  );
}

/** Шнур с квадратным узлом вдоль левого края приглашения. */
function KnotCord() {
  return (
    <div aria-hidden="true" className="relative w-6 shrink-0">
      <svg
        viewBox="0 0 24 26"
        fill="none"
        className="block h-[26px] w-6 text-espresso/45"
      >
        <path d="M9 0v10M15 0v10" stroke="currentColor" strokeWidth="1" />
        <rect
          x="2.5"
          y="10.5"
          width="18"
          height="7"
          rx="3.5"
          stroke="currentColor"
        />
        <rect
          x="3.5"
          y="18"
          width="18"
          height="7"
          rx="3.5"
          stroke="currentColor"
        />
      </svg>
      <span className="absolute top-[26px] bottom-0 left-[8.5px] w-px bg-gradient-to-b from-espresso/30 to-transparent" />
      <span className="absolute top-[26px] bottom-0 left-[14.5px] w-px bg-gradient-to-b from-espresso/30 to-transparent" />
    </div>
  );
}

/**
 * Приглашение в группу как часть содержания страницы: работы участниц и
 * ответы Ольги. Не закрывается — на странице курса и в кабинете группа
 * нужна и тем, кто в ней уже состоит.
 */
export function CommunityNote({
  source,
  title,
  text,
  labelPrefix = "Открыть группу в ",
  className,
}: {
  source: string;
  title: string;
  text: string;
  labelPrefix?: string;
  className?: string;
}) {
  if (COMMUNITY_LINKS.length === 0) return null;
  return (
    <aside
      aria-label="Группа Stariva в мессенджерах"
      className={cn(
        "flex gap-4 rounded-2xl bg-sand p-5 sm:gap-5 sm:p-6",
        className,
      )}
    >
      <KnotCord />
      <div className="min-w-0 pt-0.5">
        <h2 className="mb-2 font-serif text-xl text-espresso text-balance">
          {title}
        </h2>
        <p className="mb-5 max-w-[60ch] text-sm leading-relaxed text-dark-grey">
          {text}
        </p>
        <CommunityLinks
          source={source}
          labelPrefix={labelPrefix}
          className="flex flex-wrap gap-2"
          linkClassName="inline-flex min-h-11 items-center gap-2.5 rounded-full bg-espresso px-5 py-2.5 text-sm text-parchment hover:bg-dark-grey transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-espresso/40 focus-visible:ring-offset-2"
          iconClassName="size-4 shrink-0"
        />
      </div>
    </aside>
  );
}
