import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Карточка-обёртка для форм авторизации в фирменном стиле. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-white/70 ring-1 ring-espresso/8 rounded-2xl shadow-[0_8px_48px_rgba(44,36,27,0.10)] overflow-hidden">
      <div className="p-7 sm:p-8">
        <h1 className="font-serif text-2xl text-espresso mb-1.5">{title}</h1>
        {description && (
          <p className="text-taupe text-sm leading-relaxed mb-6">
            {description}
          </p>
        )}
        {children}
      </div>
      {footer && (
        <div className="px-7 sm:px-8 py-4 bg-sand/50 border-t border-espresso/8 text-center text-sm text-taupe">
          {footer}
        </div>
      )}
    </div>
  );
}
