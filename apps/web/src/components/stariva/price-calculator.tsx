"use client";

import { motion } from "motion/react";
import {
  COLORS,
  COMPLEXITIES,
  calculatePrice,
  formatRub,
  PRODUCT_TYPES,
  type PriceSelection,
  type PricingOption,
  SIZES,
} from "@/lib/custom-order/pricing";
import { cn } from "@/lib/utils";

interface PriceCalculatorProps {
  selection: Partial<PriceSelection>;
  onChange: (selection: Partial<PriceSelection>) => void;
}

interface OptionGroupProps {
  label: string;
  options: Array<{ id: string; label: string; hint?: string }>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

function OptionGroup({
  label,
  options,
  selectedId,
  onSelect,
}: OptionGroupProps) {
  return (
    <div>
      <span className="label-caps text-taupe text-[11px] mb-3 block">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.id === selectedId;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              aria-pressed={active}
              className={cn(
                "px-4 py-2.5 rounded-full text-sm transition-colors duration-200 border text-left",
                active
                  ? "bg-espresso text-parchment border-espresso"
                  : "bg-parchment text-espresso/75 border-espresso/15 hover:border-espresso/40",
              )}
            >
              <span>{option.label}</span>
              {option.hint ? (
                <span
                  className={cn(
                    "ml-1.5 text-[11px]",
                    active ? "text-parchment/60" : "text-taupe",
                  )}
                >
                  {option.hint}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const toOption = (o: PricingOption | (typeof PRODUCT_TYPES)[number]) => ({
  id: o.id,
  label: o.label,
  hint: "hint" in o ? o.hint : undefined,
});

export function PriceCalculator({ selection, onChange }: PriceCalculatorProps) {
  const estimate = calculatePrice(selection);

  const update = (patch: Partial<PriceSelection>) =>
    onChange({ ...selection, ...patch });

  return (
    <div className="space-y-7">
      <OptionGroup
        label="Тип изделия"
        options={PRODUCT_TYPES.map(toOption)}
        selectedId={selection.productType}
        onSelect={(id) => update({ productType: id })}
      />
      <OptionGroup
        label="Размер"
        options={SIZES.map(toOption)}
        selectedId={selection.size}
        onSelect={(id) => update({ size: id })}
      />
      <OptionGroup
        label="Цвет"
        options={COLORS.map(toOption)}
        selectedId={selection.color}
        onSelect={(id) => update({ color: id })}
      />
      <OptionGroup
        label="Сложность плетения"
        options={COMPLEXITIES.map(toOption)}
        selectedId={selection.complexity}
        onSelect={(id) => update({ complexity: id })}
      />

      {/* Live price */}
      <motion.div
        layout
        className="mt-2 p-6 rounded-sm bg-espresso text-parchment"
      >
        <span className="label-caps text-parchment/60 text-[11px] block mb-2">
          Примерная стоимость
        </span>
        {estimate ? (
          <>
            <div className="font-serif text-3xl lg:text-4xl leading-none">
              {formatRub(estimate.min)} – {formatRub(estimate.max)}
            </div>
            <p className="text-parchment/55 text-[12px] leading-relaxed mt-3">
              Ориентировочный диапазон. Точную цену мастер подтвердит после
              обсуждения деталей.
            </p>
          </>
        ) : (
          <p className="text-parchment/70 text-sm leading-relaxed">
            Выберите тип изделия, чтобы увидеть примерную стоимость.
          </p>
        )}
      </motion.div>
    </div>
  );
}
