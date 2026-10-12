import { CheckIcon, ImageOffIcon } from "lucide-react";
import Image from "next/image";
import {
  type OrderKind,
  type OrderProgress,
  orderStatusLabel,
  orderStatusTone,
  type StatusTone,
} from "@/lib/commerce/order-status";
import { formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";

export const money = (kopecks: number) => formatPrice(kopecks / 100);

export const orderDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const kindLabels: Record<OrderKind, string> = {
  workshop: "Мастер-класс",
  stock: "Готовое изделие",
  made_to_order: "Под заказ",
};

/** Монохромная палитра: важность статуса — через заливку, а не цвет. */
const toneClasses: Record<StatusTone, string> = {
  attention: "bg-espresso text-parchment",
  progress: "bg-linen text-espresso",
  success: "border border-espresso/20 text-espresso",
  muted: "border border-espresso/10 text-taupe",
};

export function StatusBadge({
  kind,
  status,
  className,
}: {
  kind: OrderKind;
  status: string;
  className?: string;
}) {
  const tone = orderStatusTone(kind, status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {tone === "success" ? (
        <CheckIcon className="size-3" aria-hidden="true" />
      ) : (
        tone !== "muted" && (
          <span
            className={cn(
              "size-1.5 rounded-full",
              tone === "attention" ? "bg-parchment" : "bg-espresso",
            )}
            aria-hidden="true"
          />
        )
      )}
      {orderStatusLabel(kind, status)}
    </span>
  );
}

export function ItemImage({
  src,
  alt,
  sizes,
  className,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-sand flex-shrink-0",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-taupe/50">
          <ImageOffIcon className="size-5" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

/** Короткая шкала для списка: отрезки по этапам и подпись текущего. */
export function ProgressBar({ progress }: { progress: OrderProgress }) {
  const { steps, reached } = progress;
  const next = steps[reached + 1];
  return (
    <div>
      <div className="flex gap-1" aria-hidden="true">
        {steps.map((step, i) => (
          <span
            key={step}
            className={cn(
              "h-1 flex-1 rounded-full",
              i <= reached ? "bg-espresso" : "bg-espresso/10",
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-taupe">
        Этап {reached + 1} из {steps.length}: {steps[reached]}
        {next && <span className="hidden sm:inline"> · дальше — {next}</span>}
      </p>
    </div>
  );
}

/**
 * Подробная шкала для страницы заказа: кружки этапов с подписями. Подписи —
 * только если карточке хватает ширины (container query), иначе одна строка под шкалой.
 */
export function ProgressSteps({ progress }: { progress: OrderProgress }) {
  const { steps, reached } = progress;
  const complete = reached === steps.length - 1;
  return (
    <div className="@container">
      <ol
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((step, i) => {
          const done = i < reached || complete;
          const current = i === reached && !complete;
          return (
            <li
              key={step}
              className="relative flex flex-col items-center text-center"
              aria-current={current ? "step" : undefined}
            >
              {i > 0 && (
                <span
                  className={cn(
                    "absolute top-3 right-1/2 h-px w-full -z-0",
                    i <= reached ? "bg-espresso" : "bg-espresso/15",
                  )}
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex size-6 items-center justify-center rounded-full text-[11px] font-medium",
                  done && "bg-espresso text-parchment",
                  current &&
                    "bg-parchment text-espresso ring-2 ring-espresso ring-offset-2 ring-offset-white",
                  !done &&
                    !current &&
                    "bg-white border border-espresso/15 text-taupe",
                )}
              >
                {done ? (
                  <CheckIcon className="size-3.5" aria-hidden="true" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "mt-2 hidden @md:block text-[11px] leading-tight px-1",
                  i <= reached ? "text-espresso" : "text-taupe",
                  current && "font-medium",
                )}
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-sm text-espresso @md:hidden">
        {steps[reached]}
        <span className="text-taupe">
          {" "}
          · этап {reached + 1} из {steps.length}
        </span>
      </p>
    </div>
  );
}
