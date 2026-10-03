import type { SVGProps } from "react";

interface StarivaMarkProps extends SVGProps<SVGSVGElement> {
  accentClassName?: string;
}

/** Знак бренда: арка-ателье со звездой, под ней панно макраме — перекладина, плоский узел, бусина и бахрома. */
export function StarivaMark({
  accentClassName = "text-terracotta",
  className,
  ...props
}: StarivaMarkProps) {
  return (
    <svg
      viewBox="0 0 40 52"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M5 50V21A15 15 0 0 1 35 21V50" strokeWidth="1.1" />
      <path
        d="M8.5 50V21.5A11.5 11.5 0 0 1 31.5 21.5V50"
        strokeWidth="0.6"
        opacity="0.45"
      />
      <path d="M2.5 50H37.5" strokeWidth="1.1" />

      <path
        d="M20 9.2L20.9 11.1L22.8 12L20.9 12.9L20 14.8L19.1 12.9L17.2 12L19.1 11.1Z"
        fill="currentColor"
        stroke="none"
        className={`${accentClassName} origin-center transition-transform duration-700 [transform-box:fill-box] group-hover:rotate-90`}
      />

      <path d="M13.5 19H26.5" strokeWidth="1.5" />
      <circle cx="12.3" cy="19" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="27.7" cy="19" r="1.1" fill="currentColor" stroke="none" />

      <path d="M16 19C16 25 24 26 24 31C24 36 16 37 16 43" strokeWidth="1.2" />
      <path
        d="M24 19C24 25 16 26 16 31C16 36 24 37 24 43"
        strokeWidth="1.2"
        className={accentClassName}
      />
      <path
        d="M20 28.4L22.6 31L20 33.6L17.4 31Z"
        fill="currentColor"
        stroke="none"
        className={accentClassName}
      />

      <path d="M16 43V47.5M24 43V47.5" strokeWidth="0.9" />
      <path
        d="M15 43.6L13.8 47M25 43.6L26.2 47"
        strokeWidth="0.6"
        opacity="0.6"
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
    mark: "h-8 w-auto",
    word: "text-[17px]",
    sub: "text-[7.5px]",
    gap: "gap-2.5",
  },
  md: {
    mark: "h-10 w-auto lg:h-11",
    word: "text-[20px] lg:text-[23px]",
    sub: "text-[8px] lg:text-[8.5px]",
    gap: "gap-3",
  },
  lg: {
    mark: "h-16 w-auto lg:h-20",
    word: "text-4xl lg:text-5xl",
    sub: "text-[10px] lg:text-[11px]",
    gap: "gap-5",
  },
};

/** Полный логотип Stariva: знак-арка и вордмарк ателье с тонкими линейками. */
export function StarivaLogo({
  tone = "dark",
  size = "md",
  tagline = false,
  className = "",
}: StarivaLogoProps) {
  const s = sizes[size];
  const isDark = tone === "dark";
  const rule = isDark ? "bg-terracotta/60" : "bg-white/45";
  const muted = isDark ? "text-espresso/60" : "text-white/70";

  return (
    <span
      className={`inline-flex items-center ${s.gap} transition-colors ${isDark ? "text-espresso" : "text-white"} ${className}`}
    >
      <StarivaMark
        className={s.mark}
        accentClassName={isDark ? "text-terracotta" : "text-white/70"}
      />
      <span className="flex flex-col items-center leading-none">
        <span
          className={`font-serif font-light uppercase tracking-[0.34em] -mr-[0.34em] ${s.word}`}
        >
          Stariva
        </span>
        <span
          className={`mt-1.5 flex w-full items-center gap-2 ${s.sub} ${muted}`}
        >
          <span className={`h-px flex-1 ${rule}`} />
          <span className="uppercase tracking-[0.42em] -mr-[0.42em] whitespace-nowrap">
            {tagline ? "Ателье макраме" : "Atelier"}
          </span>
          <span className={`h-px flex-1 ${rule}`} />
        </span>
      </span>
    </span>
  );
}
