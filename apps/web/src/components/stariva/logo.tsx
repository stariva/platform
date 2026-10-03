import type { SVGProps } from "react";

interface StarivaMarkProps extends SVGProps<SVGSVGElement> {
  accentClassName?: string;
}

/** Знак бренда: одна тонкая арка и маленькая звезда-узел внутри. */
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
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M3 31V12a9 9 0 0 1 18 0v19" strokeWidth="1.25" />
      <path
        d="M12 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"
        fill="currentColor"
        stroke="none"
        className={`${accentClassName} origin-center transition-transform duration-700 [transform-box:fill-box] group-hover:rotate-90`}
      />
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
  sm: {
    mark: "h-6 w-auto",
    word: "text-base",
    sub: "text-[9px]",
    gap: "gap-2",
  },
  md: {
    mark: "h-7 w-auto lg:h-8",
    word: "text-lg lg:text-xl",
    sub: "text-[9px] lg:text-[10px]",
    gap: "gap-2.5",
  },
  lg: {
    mark: "h-12 w-auto lg:h-14",
    word: "text-3xl lg:text-4xl",
    sub: "text-[10px] lg:text-[11px]",
    gap: "gap-4",
  },
};

/** Логотип Stariva: тонкая арка и строгий вордмарк без лишних деталей. */
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
        className={s.mark}
        accentClassName={isDark ? "text-terracotta" : "text-white/70"}
      />
      <span className="flex flex-col leading-none">
        <span
          className={`font-serif font-light uppercase tracking-[0.28em] ${s.word}`}
        >
          Stariva
        </span>
        {tagline && (
          <span
            className={`mt-1.5 uppercase tracking-[0.3em] ${s.sub} ${isDark ? "text-espresso/50" : "text-white/60"}`}
          >
            Ателье макраме
          </span>
        )}
      </span>
    </span>
  );
}
