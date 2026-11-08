import { cn } from "@/lib/utils";
import { TelegramIcon } from "./icons";

/**
 * Приглашение в закрытый чат поддержки курса: вопросы по плетению и фото
 * работы. Показывается только купившим, поэтому ссылку получает серверная
 * страница и передаёт сюда готовой.
 */
export function SupportChatCard({
  href,
  title = "Чат поддержки участниц",
  text = "Если что-то не получается, напишите в чат: Ольга и другие участницы подскажут. Там же можно показать, что получилось.",
  className,
}: {
  href: string;
  title?: string;
  text?: string;
  className?: string;
}) {
  return (
    <aside
      aria-label="Чат поддержки"
      className={cn("rounded-2xl bg-white p-5 sm:p-6", className)}
    >
      <div className="flex gap-4">
        <TelegramIcon className="mt-0.5 size-5 shrink-0 text-terracotta" />
        <div className="min-w-0">
          <h2 className="mb-1 font-serif text-xl text-espresso text-balance">
            {title}
          </h2>
          <p className="mb-4 max-w-[60ch] text-sm leading-relaxed text-dark-grey">
            {text}
          </p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2.5 rounded-full bg-espresso px-5 py-2.5 text-sm text-parchment transition-colors hover:bg-dark-grey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-espresso/40 focus-visible:ring-offset-2"
          >
            Открыть чат в Telegram
          </a>
        </div>
      </div>
    </aside>
  );
}
