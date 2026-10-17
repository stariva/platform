import { MailCheckIcon } from "lucide-react";
import type { ReactNode } from "react";

interface SentNoticeProps {
  title: string;
  email: string;
  children: ReactNode;
  hint?: ReactNode;
  onRetry?: () => void;
}

/** Состояние «письмо отправлено» внутри AuthCard. */
export function SentNotice({
  title,
  email,
  children,
  hint,
  onRetry,
}: SentNoticeProps) {
  return (
    <div className="text-center" role="status">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-sand ring-1 ring-espresso/8">
        <MailCheckIcon className="size-6 text-espresso" strokeWidth={1.5} />
      </div>
      <p className="font-serif text-xl text-espresso">{title}</p>
      <p className="mt-3 inline-block max-w-full truncate rounded-full border border-espresso/10 bg-sand/60 px-3.5 py-1 text-sm font-medium text-espresso">
        {email}
      </p>
      <p className="mt-3 text-taupe text-sm leading-relaxed">{children}</p>
      {hint && (
        <p className="mt-5 rounded-xl bg-sand/70 px-4 py-3 text-left text-sm leading-relaxed text-taupe">
          {hint}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 text-sm text-taupe underline underline-offset-4 decoration-espresso/25 hover:text-espresso hover:decoration-espresso"
        >
          Указать другой адрес
        </button>
      )}
    </div>
  );
}
