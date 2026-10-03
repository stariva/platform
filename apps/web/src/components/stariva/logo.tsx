import type { SVGProps } from "react";

interface StarivaMarkProps extends SVGProps<SVGSVGElement> {
  accentClassName?: string;
}

/** Знак бренда: два шнура на перекладине, сплетённые в плоский узел макраме. */
export function StarivaMark({
  accentClassName = "text-terracotta",
  className,
  ...props
}: StarivaMarkProps) {
  return (
    <svg
      viewBox="0 0 24 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M3.5 3.5H20.5" strokeWidth="1.6" />
      <path d="M8 3.5C8 9.5 16 10 16 16C16 22 8 22.5 8 28.5" />
      <path
        d="M16 3.5C16 9.5 8 10 8 16C8 22 16 22.5 16 28.5"
        className={accentClassName}
      />
      <path d="M8 28.5L6.5 30.5M16 28.5L17.5 30.5" strokeWidth="1" />
    </svg>
  );
}

interface StarivaLogoProps {
  tone?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  tagline?: boolean;
  className?: string;
}

const sizes = {
  sm: { mark: "h-7 w-auto", word: "text-[17px]", gap: "gap-2" },
  md: {
    mark: "h-8 w-auto lg:h-9",
    word: "text-[19px] lg:text-[22px]",
    gap: "gap-2.5",
  },
  lg: {
    mark: "h-14 w-auto lg:h-16",
    word: "text-4xl lg:text-5xl",
    gap: "gap-4",
  },
};

/** Полный логотип Stariva: знак-узел и разреженный серифный вордмарк. */
export function StarivaLogo({
  tone = "dark",
  size = "md",
  tagline = false,
  className = "",
}: StarivaLogoProps) {
  const s = sizes[size];
  const isDark = tone === "dark";

  return (
    <span
      className={`inline-flex items-center ${s.gap} transition-colors ${isDark ? "text-espresso" : "text-white"} ${className}`}
    >
      <StarivaMark
        className={`${s.mark} transition-transform duration-500 group-hover:-rotate-6`}
        accentClassName={isDark ? "text-terracotta" : "text-white/55"}
      />
      <span className="flex flex-col leading-none">
        <span
          className={`font-serif uppercase font-medium tracking-[0.2em] ${s.word}`}
        >
          Stariva
        </span>
        {tagline && (
          <span
            className={`mt-1.5 text-[10px] uppercase tracking-[0.32em] ${isDark ? "text-espresso/55" : "text-white/60"}`}
          >
            Макраме ручной работы
          </span>
        )}
      </span>
    </span>
  );
}
