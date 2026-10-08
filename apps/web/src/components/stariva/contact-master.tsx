"use client";

import { CheckIcon, ChevronRightIcon, CopyIcon } from "lucide-react";
import {
  type ComponentProps,
  type ComponentType,
  type MouseEvent,
  type SVGProps,
  useEffect,
  useState,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { reachGoal } from "@/lib/analytics";
import { CONTACTS, type ContactChannel, whatsappUrl } from "@/lib/contacts";
import { MaxIcon, PhoneIcon, TelegramIcon, WhatsappIcon } from "./icons";

type ContactMasterButtonProps = Omit<
  ComponentProps<"a">,
  "href" | "target" | "rel"
> & {
  /** Где стоит кнопка — уходит в Метрику вместе с выбранным каналом. */
  source: string;
  /** Готовый текст обращения: подставляется в WhatsApp, для остальных копируется. */
  message?: string;
  /** Добавить к тексту ссылку на текущую страницу (без UTM и прочих параметров). */
  withPageLink?: boolean;
  /** Дополнительная цель Метрики при открытии окна, например для Директа. */
  goal?: string;
};

/**
 * Кнопка «Написать мастеру»: открывает окно выбора мессенджера или телефона.
 * Без JavaScript и при открытии в новой вкладке остаётся обычной ссылкой на Telegram.
 */
export function ContactMasterButton({
  source,
  message,
  withPageLink,
  goal,
  onClick,
  children,
  ...props
}: ContactMasterButtonProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(message);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    setText(
      message && withPageLink
        ? `${message}\n${window.location.origin}${window.location.pathname}`
        : message,
    );
    setOpen(true);
    reachGoal("contact_master_open", { source });
    if (goal) reachGoal(goal);
  };

  return (
    <>
      <a
        {...props}
        href={CONTACTS.telegramUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-haspopup="dialog"
        onClick={handleClick}
      >
        {children}
      </a>
      <ContactMasterSheet
        open={open}
        onOpenChange={setOpen}
        source={source}
        message={text}
      />
    </>
  );
}

interface ContactMasterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: string;
  message?: string;
}

// z-[65]: выше кнопки чат-консультанта (z-60), ниже баннера cookie (z-[70]).
function ContactMasterSheet({
  open,
  onOpenChange,
  source,
  message,
}: ContactMasterSheetProps) {
  const isMobile = useIsMobile();
  const body = (
    <ContactOptions
      source={source}
      message={message}
      onPick={() => onOpenChange(false)}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          overlayClassName="z-[65]"
          className="z-[65] bg-parchment border-espresso/10 max-h-[92vh]"
        >
          <div className="overflow-y-auto px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <MasterHeader kind="drawer" />
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[65]"
        className="z-[65] bg-parchment border-espresso/10 rounded-3xl p-7 sm:max-w-md gap-0"
      >
        <MasterHeader kind="dialog" />
        {body}
      </DialogContent>
    </Dialog>
  );
}

function MasterHeader({ kind }: { kind: "drawer" | "dialog" }) {
  const Title = kind === "drawer" ? DrawerTitle : DialogTitle;
  const Description = kind === "drawer" ? DrawerDescription : DialogDescription;
  return (
    <div className="flex items-center gap-4 pr-6">
      <span
        aria-hidden="true"
        className="size-14 shrink-0 rounded-full bg-linen bg-no-repeat ring-1 ring-espresso/10"
        style={{
          backgroundImage: `url(${CONTACTS.avatar})`,
          backgroundSize: "auto 210%",
          backgroundPosition: "57% 12%",
        }}
      />
      <div className="min-w-0 text-left">
        <Title className="font-serif text-espresso text-xl leading-tight font-normal">
          Как вам удобнее связаться?
        </Title>
        <Description className="mt-1 text-[13px] leading-snug text-taupe">
          {CONTACTS.master} отвечает лично, {CONTACTS.hours}
        </Description>
      </div>
    </div>
  );
}

interface ChannelOption {
  id: ContactChannel;
  label: string;
  hint: string;
  href: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

function ContactOptions({
  source,
  message,
  onPick,
}: {
  source: string;
  message?: string;
  onPick: () => void;
}) {
  const [copied, setCopied] = useState<"message" | "phone" | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = (value: string, key: "message" | "phone") => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => setCopied(key))
      .catch(() => {
        /* без буфера обмена текст можно выделить вручную */
      });
  };

  const pasteHint = message ? "Скопируем текст для чата" : null;
  const channels: ChannelOption[] = [
    {
      id: "telegram",
      label: "Telegram",
      hint: pasteHint ?? CONTACTS.telegramHandle,
      href: CONTACTS.telegramUrl,
      Icon: TelegramIcon,
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      hint: message ? "Сообщение будет уже набрано" : "Чат с мастером",
      href: whatsappUrl(message),
      Icon: WhatsappIcon,
    },
    {
      id: "max",
      label: "MAX",
      hint: pasteHint ?? "Национальный мессенджер",
      href: CONTACTS.maxUrl,
      Icon: MaxIcon,
    },
  ];

  const pick = async (channel: ContactChannel) => {
    setCopyFailed(false);
    if (message && (channel === "telegram" || channel === "max")) {
      try {
        await navigator.clipboard.writeText(message);
      } catch {
        setCopyFailed(true);
        return;
      }
    }
    reachGoal("contact_master", { channel, source });
    onPick();
  };

  return (
    <div className="mt-6">
      {message && (
        <div className="mb-4 rounded-2xl bg-sand px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="label-caps text-[10px] text-taupe">Ваше сообщение</p>
            <button
              type="button"
              onClick={() => copy(message, "message")}
              className="inline-flex items-center gap-1.5 text-[12px] text-espresso/70 hover:text-espresso transition-colors"
            >
              {copied === "message" ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
              {copied === "message" ? "Скопировано" : "Скопировать"}
            </button>
          </div>
          <p className="mt-1.5 text-[14px] leading-snug text-espresso whitespace-pre-line break-words select-text">
            {message}
          </p>
          {copyFailed && (
            <p role="alert" className="mt-2 text-[12px] text-espresso">
              Не удалось скопировать сообщение. Выделите и скопируйте текст
              вручную.
            </p>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {channels.map(({ id, label, hint, href, Icon }) => (
          <li key={id}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => pick(id)}
              className="group flex items-center gap-4 rounded-2xl border border-espresso/10 bg-white px-4 py-3.5 transition-colors hover:border-espresso/30 hover:bg-sand focus-visible:outline-2 focus-visible:outline-espresso"
            >
              <ChannelIcon Icon={Icon} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-espresso">
                  {label}
                </span>
                <span className="block truncate text-[12.5px] text-taupe">
                  {hint}
                </span>
              </span>
              <ChevronRightIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-espresso/30 transition-transform group-hover:translate-x-0.5 group-hover:text-espresso/60"
              />
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-3 border-t border-espresso/10 pt-4">
        <a
          href={CONTACTS.phoneHref}
          onClick={() => pick("phone")}
          className="group flex min-w-0 flex-1 items-center gap-4 rounded-2xl px-1 py-1 focus-visible:outline-2 focus-visible:outline-espresso"
        >
          <ChannelIcon Icon={PhoneIcon} />
          <span className="min-w-0">
            <span className="block text-[12.5px] text-taupe">
              Или позвоните
            </span>
            <span className="block font-serif text-lg text-espresso group-hover:underline underline-offset-4">
              {CONTACTS.phone}
            </span>
          </span>
        </a>
        <button
          type="button"
          onClick={() => copy(CONTACTS.phone, "phone")}
          aria-label="Скопировать номер телефона"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-espresso/60 hover:bg-sand hover:text-espresso transition-colors"
        >
          {copied === "phone" ? (
            <CheckIcon className="size-4" />
          ) : (
            <CopyIcon className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function ChannelIcon({
  Icon,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-espresso text-parchment">
      <Icon className="size-5" />
    </span>
  );
}
