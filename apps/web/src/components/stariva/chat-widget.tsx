"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import { AnimatePresence, motion } from "motion/react";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { CHAT_GREETING, CHAT_SUGGESTIONS } from "@/lib/chat/knowledge";
import type {
  ArticleCard,
  EstimateResult,
  ProductCard,
  WorkshopCard,
} from "@/lib/chat/tools";
import { cn } from "@/lib/utils";

// ─── Иконки (в стиле проекта — тонкие линии 1.3) ────────────────────────────

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M4 5.5C4 4.7 4.7 4 5.5 4h13c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5H9l-4 3.5V15H5.5C4.7 15 4 14.3 4 13.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M8 8.5h8M8 11h5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2 2l12 12M14 2L2 14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M21.5 4.5 2.5 11.5l5.8 2.2 2.4 6.3 3.4-3.4 4.8 3.5 2.6-15.6Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="m8.3 13.7 9-6.7-6.6 8.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="7"
        y="7"
        width="10"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Вспомогательное ────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span
      className="inline-flex items-center gap-1"
      role="status"
      aria-label="Печатает"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-1.5 h-1.5 rounded-full bg-espresso/40"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.15,
          }}
        />
      ))}
    </span>
  );
}

// ─── Карточки результатов инструментов ──────────────────────────────────────

function CardShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-2 space-y-2"
    >
      {children}
    </motion.div>
  );
}

function ToolThinking({ label }: { label: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl bg-sand/70 px-3 py-2 text-espresso/60 text-[12.5px]">
      <span className="flex h-3.5 w-3.5">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-espresso/25 border-t-espresso/60" />
      </span>
      {label}
    </div>
  );
}

function Thumb({ src, alt }: { src?: string; alt: string }) {
  if (!src) {
    return (
      <div className="h-14 w-14 shrink-0 rounded-lg bg-linen/60 flex items-center justify-center text-taupe text-[10px]">
        Stariva
      </div>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: внешние изображения Ozon, next/image требует remotePatterns
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="h-14 w-14 shrink-0 rounded-lg object-cover bg-linen/60"
    />
  );
}

function ProductCards({ products }: { products: ProductCard[] }) {
  if (products.length === 0) return null;
  return (
    <CardShell>
      {products.map((p) => (
        <a
          key={p.slug}
          href={p.url}
          target={p.url.startsWith("http") ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-xl border border-espresso/10 bg-white px-2.5 py-2.5 transition-colors hover:border-espresso/30"
        >
          <Thumb src={p.image} alt={p.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-[13.5px] text-espresso leading-snug">
              {p.name}
            </p>
            <p className="text-[11px] text-taupe">{p.categoryLabel}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="font-serif text-[14px] text-espresso">
                {p.priceFormatted}
              </span>
              {p.oldPriceFormatted && (
                <span className="text-[11px] text-taupe line-through">
                  {p.oldPriceFormatted}
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 text-espresso/30 transition-colors group-hover:text-terracotta">
            <ArrowIcon className="h-4 w-4" />
          </span>
        </a>
      ))}
    </CardShell>
  );
}

function EstimateCardView({ data }: { data: EstimateResult }) {
  return (
    <CardShell>
      <div className="rounded-xl border border-espresso/10 bg-white p-3.5">
        <p className="text-[11px] uppercase tracking-wide text-taupe">
          Ориентировочная стоимость
        </p>
        <p className="mt-1 font-serif text-[20px] text-espresso leading-tight">
          {data.rangeFormatted}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {[
            data.productLabel,
            data.sizeLabel,
            data.colorLabel,
            data.complexityLabel,
          ].map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-sand px-2.5 py-1 text-[11px] text-espresso/75"
            >
              {chip}
            </span>
          ))}
        </div>
        <p className="mt-2.5 text-[12px] text-espresso/70 leading-relaxed">
          Срок изготовления: {data.productionDays}. Точную цену подтвердит
          мастер.
        </p>
      </div>
    </CardShell>
  );
}

function WorkshopCards({ workshops }: { workshops: WorkshopCard[] }) {
  if (workshops.length === 0) return null;
  return (
    <CardShell>
      {workshops.map((w) => (
        <a
          key={w.slug}
          href={w.url}
          className="group flex items-center gap-3 rounded-xl border border-espresso/10 bg-white px-2.5 py-2.5 transition-colors hover:border-espresso/30"
        >
          <Thumb src={w.image} alt={w.title} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-[13.5px] text-espresso leading-snug">
              {w.title}
            </p>
            <p className="text-[11px] text-taupe">
              {w.level} · {w.lessonsCount} уроков · {w.duration}
            </p>
            <span className="mt-0.5 inline-block font-serif text-[14px] text-espresso">
              {w.priceFormatted}
            </span>
          </div>
          <span className="shrink-0 text-espresso/30 transition-colors group-hover:text-terracotta">
            <ArrowIcon className="h-4 w-4" />
          </span>
        </a>
      ))}
    </CardShell>
  );
}

function ArticleCards({ articles }: { articles: ArticleCard[] }) {
  if (articles.length === 0) return null;
  return (
    <CardShell>
      {articles.map((a) => (
        <a
          key={a.slug}
          href={a.url}
          className="group flex items-center gap-3 rounded-xl border border-espresso/10 bg-white px-2.5 py-2.5 transition-colors hover:border-espresso/30"
        >
          <Thumb src={a.image} alt={a.title} />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-medium text-[13px] text-espresso leading-snug">
              {a.title}
            </p>
            <p className="text-[11px] text-taupe">
              {a.category} · {a.readTime}
            </p>
          </div>
          <span className="shrink-0 text-espresso/30 transition-colors group-hover:text-terracotta">
            <ArrowIcon className="h-4 w-4" />
          </span>
        </a>
      ))}
    </CardShell>
  );
}

interface ContactsData {
  telegram: string;
  telegramUrl: string;
  phone: string;
  schedule: string;
  master: string;
  marketplace: string;
}

function ContactsCard({ data }: { data: ContactsData }) {
  return (
    <CardShell>
      <div className="rounded-xl border border-espresso/10 bg-white p-3.5 text-[13px] text-espresso/85 space-y-2">
        <a
          href={data.telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 font-medium text-espresso hover:text-terracotta transition-colors"
        >
          <ArrowIcon className="h-3.5 w-3.5" />
          Telegram {data.telegram}
        </a>
        <a
          href={`tel:${data.phone.replace(/\s/g, "")}`}
          className="flex items-center gap-2 hover:text-terracotta transition-colors"
        >
          <ArrowIcon className="h-3.5 w-3.5" />
          {data.phone}
        </a>
        <p className="text-[12px] text-espresso/65 leading-relaxed pt-0.5">
          {data.schedule}
        </p>
      </div>
    </CardShell>
  );
}

/** Рендерит вывод одного tool-part в соответствующую карточку. */
function ToolPart({
  part,
}: {
  part: { type: string; state?: string; output?: unknown };
}) {
  const name = part.type.replace(/^tool-/, "");
  const ready = part.state === "output-available";

  if (part.state === "output-error") {
    return (
      <div className="mt-2 rounded-xl bg-destructive/10 px-3 py-2 text-destructive text-[12.5px]">
        Не получилось загрузить данные. Попробуйте переформулировать вопрос.
      </div>
    );
  }

  if (!ready) {
    const labels: Record<string, string> = {
      searchProducts: "Ищу изделия в каталоге…",
      estimateCustomOrder: "Считаю стоимость заказа…",
      findWorkshops: "Подбираю мастер-классы…",
      searchArticles: "Ищу статьи с советами…",
      getContacts: "Открываю контакты…",
    };
    return <ToolThinking label={labels[name] ?? "Обрабатываю запрос…"} />;
  }

  const output = part.output as Record<string, unknown>;

  switch (name) {
    case "searchProducts":
      return (
        <ProductCards products={(output?.products as ProductCard[]) ?? []} />
      );
    case "estimateCustomOrder":
      return "error" in output ? null : (
        <EstimateCardView data={output as unknown as EstimateResult} />
      );
    case "findWorkshops":
      return (
        <WorkshopCards
          workshops={(output?.workshops as WorkshopCard[]) ?? []}
        />
      );
    case "searchArticles":
      return (
        <ArticleCards articles={(output?.articles as ArticleCard[]) ?? []} />
      );
    case "getContacts":
      return <ContactsCard data={output as unknown as ContactsData} />;
    default:
      return null;
  }
}

interface MessageLike {
  id: string;
  role: string;
  parts: Array<{
    type: string;
    text?: string;
    state?: string;
    output?: unknown;
  }>;
}

/** Рендерит сообщение целиком: текстовые пузыри + карточки инструментов. */
function MessageView({ message }: { message: MessageLike }) {
  const isUser = message.role === "user";

  return (
    <>
      {message.parts.map((part, i) => {
        if (part.type === "text" && part.text) {
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: порядок частей сообщения стабилен, своих id у частей нет
              key={`${message.id}-t${i}`}
              className={cn("flex", isUser ? "justify-end" : "")}
            >
              <div
                className={cn(
                  "max-w-[85%] px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap wrap-break-word",
                  isUser
                    ? "rounded-2xl rounded-br-sm bg-espresso text-parchment"
                    : "rounded-2xl rounded-tl-sm bg-sand text-espresso/90",
                )}
              >
                {part.text}
              </div>
            </div>
          );
        }
        if (isToolUIPart(part as never)) {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: порядок частей сообщения стабилен, своих id у частей нет
            <div key={`${message.id}-tool${i}`} className="flex">
              <div className="w-[92%]">
                <ToolPart part={part} />
              </div>
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

// ─── Виджет ───────────────────────────────────────────────────────────────

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Стабильный ID сессии — живёт всё время монтирования компонента,
  // группирует трейсы одного чата в Langfuse
  const sessionId = useRef(`session-${Math.random().toString(36).slice(2)}`);

  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      body: { sessionId: sessionId.current },
    }),
  });

  const isBusy = status === "submitted" || status === "streaming";
  const hasConversation = messages.length > 0;

  // Автопрокрутка к последнему сообщению
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages and status changes
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, status, open]);

  // Фокус на поле ввода при открытии
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => textareaRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Автоувеличение высоты textarea
  // biome-ignore lint/correctness/useExhaustiveDependencies: recompute height on input change
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  function submit(text: string) {
    const value = text.trim();
    if (!value || isBusy) return;
    sendMessage({ text: value });
    setInput("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  }

  // Показываем индикатор печати, пока ассистент ещё не начал отвечать
  // (нет ни текста, ни вызванного инструмента)
  const lastMessage = messages[messages.length - 1] as MessageLike | undefined;
  const lastHasContent =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some(
      (p) => (p.type === "text" && !!p.text) || p.type.startsWith("tool-"),
    );
  const showTyping =
    status === "submitted" || (status === "streaming" && !lastHasContent);

  return (
    <>
      {/* ── Кнопка запуска ── */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Закрыть чат" : "Открыть чат с консультантом"}
        aria-expanded={open}
        initial={false}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className={cn(
          "fixed bottom-5 right-5 lg:bottom-7 lg:right-7 z-60",
          "flex items-center justify-center w-14 h-14 rounded-full",
          "bg-espresso text-parchment shadow-[0_12px_40px_rgba(22,21,19,0.28)]",
          "transition-colors duration-300 hover:bg-terracotta",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              <CloseIcon className="w-5 h-5" />
            </motion.span>
          ) : (
            <motion.span
              key="chat"
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -90 }}
              transition={{ duration: 0.2 }}
            >
              <ChatIcon className="w-6 h-6" />
            </motion.span>
          )}
        </AnimatePresence>
        {/* индикатор «онлайн» */}
        {!open && (
          <span className="absolute top-1 right-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/70 animate-ping" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 border-2 border-espresso" />
          </span>
        )}
      </motion.button>

      {/* ── Панель чата ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label="Чат с консультантом Stariva"
            className={cn(
              "fixed z-60 flex flex-col overflow-hidden bg-parchment",
              "shadow-[0_24px_70px_rgba(22,21,19,0.22)] border border-espresso/10",
              "inset-x-3 bottom-24 rounded-2xl",
              "sm:inset-x-auto sm:right-7 sm:bottom-24 sm:w-[400px]",
              "h-[min(620px,calc(100dvh-9rem))]",
            )}
          >
            {/* Header */}
            <div className="relative flex items-center gap-3 px-5 py-4 bg-espresso text-parchment">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-parchment/12 shrink-0">
                <span className="font-serif text-lg leading-none">С</span>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-espresso" />
              </div>
              <div className="min-w-0">
                <p className="font-serif text-[17px] leading-tight">Ника</p>
                <p className="text-parchment/65 text-[11px] leading-tight">
                  Цифровой помощник мастерской · онлайн
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть чат"
                className="ml-auto flex items-center justify-center w-8 h-8 rounded-full text-parchment/70 hover:text-parchment hover:bg-parchment/10 transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-5 space-y-4 scroll-smooth"
            >
              {/* Приветствие */}
              <div className="flex">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-sand px-4 py-3 text-espresso/90 text-[14px] leading-relaxed">
                  {CHAT_GREETING}
                </div>
              </div>

              {/* Сообщения диалога */}
              {messages.map((message) => (
                <MessageView
                  key={message.id}
                  message={message as unknown as MessageLike}
                />
              ))}

              {/* Индикатор печати */}
              {showTyping && (
                <div className="flex">
                  <div className="rounded-2xl rounded-tl-sm bg-sand px-4 py-3.5">
                    <TypingDots />
                  </div>
                </div>
              )}

              {/* Ошибка */}
              {error && (
                <div className="flex">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-destructive/10 px-4 py-3 text-destructive text-[13px] leading-relaxed">
                    Не удалось получить ответ. Попробуйте ещё раз или напишите
                    нам в Telegram @Olga_Stariva.
                  </div>
                </div>
              )}

              {/* Быстрые подсказки (в начале) */}
              {!hasConversation && (
                <div className="pt-1 flex flex-wrap gap-2">
                  {CHAT_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="rounded-full border border-espresso/15 bg-parchment px-3.5 py-2 text-[12.5px] text-espresso/75 hover:border-espresso/40 hover:text-espresso transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-espresso/10 bg-parchment px-3 py-3"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-espresso/15 bg-white px-3 py-2 focus-within:border-espresso/40 transition-colors">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Спросите о макраме, заказе или мастер-классах…"
                  className="flex-1 resize-none bg-transparent text-[14px] text-espresso placeholder:text-taupe leading-relaxed outline-none max-h-[120px] py-1 chat-input-scroll"
                />
                {isBusy ? (
                  <button
                    type="button"
                    onClick={() => stop()}
                    aria-label="Остановить"
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-espresso/10 text-espresso hover:bg-espresso/20 transition-colors shrink-0"
                  >
                    <StopIcon className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    aria-label="Отправить"
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-espresso text-parchment hover:bg-terracotta transition-colors shrink-0 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <SendIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-taupe text-[10.5px] text-center mt-2 leading-tight">
                Консультирую только по изделиям и услугам Stariva
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
