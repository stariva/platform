"use client";

import { TicketPercentIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatPrice } from "@/lib/products";

export type PromoFieldState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "invalid"; message: string }
  | { status: "valid"; code: string; discountKopecks: number };

interface PromoCodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  state: PromoFieldState;
  onApply: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

/**
 * Поле промокода с живыми состояниями: тряска при ошибке, плавное
 * превращение в плашку с нарисованной галочкой, когда код применён.
 */
export function PromoCodeField({
  value,
  onChange,
  state,
  onApply,
  onRemove,
  disabled = false,
}: PromoCodeFieldProps) {
  const [scope, animate] = useAnimate();
  const wasInvalid = useRef(false);

  useEffect(() => {
    if (state.status === "invalid" && !wasInvalid.current && scope.current) {
      animate(
        scope.current,
        { x: [0, -10, 10, -7, 7, -3, 3, 0] },
        { duration: 0.45, ease: "easeInOut" },
      );
    }
    wasInvalid.current = state.status === "invalid";
  }, [state.status, animate, scope]);

  const checking = state.status === "checking";

  return (
    <div className="space-y-2">
      <label
        htmlFor="instant-promo-code"
        className="text-sm font-medium text-espresso"
      >
        Промокод
      </label>
      <div ref={scope}>
        <AnimatePresence mode="wait" initial={false}>
          {state.status === "valid" ? (
            <motion.div
              key="applied"
              initial={{ opacity: 0, scale: 0.92, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
              className="flex h-12 items-center gap-3 rounded-full border border-espresso/20 bg-sand pl-4 pr-2"
            >
              <motion.svg
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className="size-5 shrink-0 text-espresso"
              >
                <motion.circle
                  cx="10"
                  cy="10"
                  r="8.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
                <motion.path
                  d="M6.4 10.3l2.4 2.4 4.8-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3, delay: 0.28, ease: "easeOut" }}
                />
              </motion.svg>
              <p className="flex-1 min-w-0 truncate text-sm text-espresso">
                <span className="font-medium uppercase tracking-wide">
                  {state.code}
                </span>
                {state.discountKopecks > 0 && (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35, duration: 0.25 }}
                    className="text-taupe"
                  >
                    {" "}
                    — скидка {formatPrice(state.discountKopecks / 100)}
                  </motion.span>
                )}
              </p>
              <button
                type="button"
                onClick={onRemove}
                aria-label="Убрать промокод"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-taupe transition-colors hover:bg-espresso/10 hover:text-espresso"
              >
                <XIcon
                  className="size-4"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
              transition={{ duration: 0.18 }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <TicketPercentIcon
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-taupe"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <Input
                  id="instant-promo-code"
                  value={value}
                  onChange={(event) => onChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onApply();
                    }
                  }}
                  placeholder="Например, NEWYEAR"
                  autoComplete="off"
                  disabled={disabled || checking}
                  aria-invalid={state.status === "invalid"}
                  className="h-12 rounded-full border-espresso/15 pl-11 pr-4 uppercase transition-shadow focus-visible:ring-espresso/20"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={onApply}
                disabled={disabled || !value.trim() || checking}
                className="h-12 shrink-0 rounded-full border-espresso/20 px-5"
              >
                {checking ? <Spinner /> : "Применить"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {state.status === "invalid" && (
          <motion.p
            key="error"
            role="alert"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 2 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden text-sm text-terracotta-dark"
          >
            {state.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
