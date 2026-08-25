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
    <div className="bg-white border border-espresso/10 rounded-2xl shadow-[0_4px_30px_rgba(44,36,27,0.08)] overflow-hidden">
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
