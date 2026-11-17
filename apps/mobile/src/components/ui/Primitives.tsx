import { AlertCircle, ArrowRight, RotateCcw } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const style =
    variant === "primary"
      ? "bg-accent text-accent-fg"
      : variant === "secondary"
        ? "bg-surface text-fg ring-1 ring-line"
        : "text-fg";
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 text-sm font-semibold transition-transform duration-[var(--duration-fast)] ease-[var(--ease)] active:scale-[.98] disabled:opacity-50 ${style} ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full px-5 text-sm font-medium ${active ? "bg-fg text-bg" : "bg-surface text-fg ring-1 ring-line"}`}
    >
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={`min-h-12 rounded-[var(--radius-md)] px-2 py-2 text-sm font-semibold leading-tight ${value === item.id ? "bg-accent text-accent-fg" : "bg-surface text-muted ring-1 ring-line"}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function BottomSheet({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <button
        type="button"
        aria-label="Закрыть окно"
        onClick={onClose}
        className="absolute inset-0 w-full bg-black/50"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass relative w-full rounded-t-[var(--radius-xl)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-fg shadow-[var(--shadow-3)]"
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="section-title">{title}</h2>
          <button
            type="button"
            aria-label="Закрыть"
            className="min-h-11 min-w-11 text-xl"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`skeleton rounded-[var(--radius-lg)] ${className}`}
    />
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-xl)] bg-surface p-4 text-center shadow-[var(--shadow-1)]">
      <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-surface-soft text-accent">
        <ArrowRight aria-hidden />
      </div>
      <h3 className="section-title">{title}</h3>
      <p className="mt-1 text-sm text-muted">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-lg)] bg-surface p-6 text-center"
    >
      <AlertCircle aria-hidden className="mx-auto mb-3 text-danger" />
      <p className="mb-4 text-sm">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        <RotateCcw size={18} aria-hidden />
        Повторить
      </Button>
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-fg">
      {children}
    </span>
  );
}
export function Avatar({ name }: { name: string }) {
  return (
    <div
      role="img"
      aria-label={name}
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-semibold text-accent-fg"
    >
      {name.trim().charAt(0).toUpperCase() || "С"}
    </div>
  );
}
export function ProgressBar({ value }: { value: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="h-2 overflow-hidden rounded-full bg-surface-soft"
    >
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
export function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="fixed inset-x-5 bottom-28 z-50 rounded-[var(--radius-md)] bg-fg p-4 text-center text-sm text-bg shadow-[var(--shadow-2)]"
    >
      {message}
    </div>
  );
}
