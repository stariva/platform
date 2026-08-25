import type { ColorInfo } from "@/lib/colors";
import { isGradientColor } from "@/lib/colors";

interface ColorIndicatorProps {
  color: ColorInfo;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-5 h-5",
  md: "w-7 h-7",
  lg: "w-10 h-10",
};

export function ColorIndicator({
  color,
  size = "md",
  showLabel = false,
  className = "",
}: ColorIndicatorProps) {
  const isGradient = isGradientColor(color);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        role="img"
        className={`${sizeClasses[size]} rounded-full border-2 border-espresso/20 shadow-sm shrink-0 transition-transform hover:scale-110 block`}
        style={{
          background: isGradient
            ? "linear-gradient(135deg, #FF6B6B 0%, #FFD93D 25%, #6BCF7F 50%, #4D96FF 75%, #9D4EDD 100%)"
            : color.hex,
        }}
        title={color.name}
        aria-label={`Цвет: ${color.name}`}
      />
      {showLabel && (
        <span className="label-caps text-[10px] text-espresso">
          {color.name}
        </span>
      )}
    </div>
  );
}

interface ColorSwatchesProps {
  colors: ColorInfo[];
  size?: "sm" | "md" | "lg";
  maxDisplay?: number;
  className?: string;
}

export function ColorSwatches({
  colors,
  size = "md",
  maxDisplay = 5,
  className = "",
}: ColorSwatchesProps) {
  const displayColors = colors.slice(0, maxDisplay);
  const remainingCount = colors.length - maxDisplay;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {displayColors.map((color, index) => (
        <ColorIndicator
          // biome-ignore lint/suspicious/noArrayIndexKey: colors are positional and stable
          key={index}
          color={color}
          size={size}
        />
      ))}
      {remainingCount > 0 && (
        <span className="label-caps text-[9px] text-taupe ml-1">
          +{remainingCount}
        </span>
      )}
    </div>
  );
}
