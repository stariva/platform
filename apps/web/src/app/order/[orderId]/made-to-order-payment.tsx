"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { OfferAcceptanceNote } from "@/components/stariva/consent-checkbox";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatPrice } from "@/lib/products";

export const madeToOrderTermsSchema = z.object({
  amountProducts: z.number().int().nonnegative(),
  depositAmount: z.number().int().nullable(),
  depositPaid: z.boolean(),
  leadTime: z.string().nullable(),
  paymentDueAt: z.string().nullable(),
  paymentOverdue: z.boolean(),
  paymentStep: z
    .object({
      type: z.enum(["deposit", "balance"]),
      amount: z.number().int().positive(),
    })
    .nullable(),
});

type Terms = z.infer<typeof madeToOrderTermsSchema> & {
  status: string;
  paid: boolean;
  amountTotal: number;
  amountDelivery: number;
};

const payResponseSchema = z.object({
  confirmationUrl: z.url({ protocol: /^https?$/ }),
});

const money = (kopecks: number) => formatPrice(kopecks / 100);

const dueFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

function Row({
  label,
  value,
  done,
  strong,
}: {
  label: string;
  value: string;
  done?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 text-sm ${strong ? "font-medium" : ""}`}
    >
      <span className="text-espresso flex items-center gap-1.5">
        {label}
        {done && (
          <CheckIcon className="size-3.5 text-sage" aria-label="оплачено" />
        )}
      </span>
      <span className="text-espresso tabular-nums text-right">{value}</span>
    </div>
  );
}

/**
 * Суммы заказа под заказ и оплата текущего этапа. До одобрения мастером цены
 * предварительные; после — предоплата 50% и доплата остатка с доставкой.
 */
export function MadeToOrderPayment({
  orderId,
  phone,
  terms,
}: {
  orderId: string;
  phone: string;
  terms: Terms;
}) {
  const [paying, setPaying] = useState(false);

  if (terms.depositAmount === null) {
    return (
      <div className="border-t border-espresso/8 pt-3 space-y-1">
        <Row label="По каталогу" value={money(terms.amountProducts)} strong />
        <p className="text-right text-xs text-taupe">
          Итоговую цену и доставку согласует мастер
        </p>
      </div>
    );
  }

  const balance = terms.amountTotal - terms.depositAmount;
  // Доплату выставляют, когда изделие готово; тогда же мастер уточняет доставку
  const balanceBilled = terms.status === "awaiting_balance" || terms.paid;
  const deliveryKnown = balanceBilled || terms.amountDelivery > 0;

  async function pay() {
    setPaying(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, offerAccepted: true }),
      });
      const data: unknown = await res.json();
      const parsed = payResponseSchema.safeParse(data);
      if (!res.ok || !parsed.success) {
        const error = z.object({ error: z.string() }).safeParse(data);
        toast.error(
          error.success ? error.data.error : "Не удалось перейти к оплате",
        );
        setPaying(false);
        return;
      }
      window.location.href = parsed.data.confirmationUrl;
    } catch {
      toast.error("Не удалось перейти к оплате. Попробуйте позже.");
      setPaying(false);
    }
  }

  const step = terms.paymentStep;

  return (
    <div className="border-t border-espresso/8 pt-3 space-y-3">
      <div className="space-y-1.5">
        <Row label="Изделия" value={money(terms.amountProducts)} />
        <Row
          label="Доставка"
          value={
            deliveryKnown
              ? money(terms.amountDelivery)
              : "уточним перед доплатой"
          }
        />
        <Row label="Итого" value={money(terms.amountTotal)} strong />
      </div>
      <div className="rounded-xl bg-sand px-4 py-3 space-y-1.5">
        <Row
          label="Предоплата 50%"
          value={money(terms.depositAmount)}
          done={terms.depositPaid}
        />
        <Row
          label={balanceBilled ? "Доплата" : "Доплата, когда изделие готово"}
          value={money(balance)}
          done={terms.paid}
        />
      </div>
      {terms.leadTime && (
        <p className="text-xs text-taupe">
          Срок изготовления: {terms.leadTime}
        </p>
      )}

      {step && (
        <div className="space-y-2">
          <Button
            type="button"
            onClick={pay}
            disabled={paying}
            className="w-full bg-terracotta text-parchment hover:bg-terracotta-dark py-6"
          >
            {paying ? (
              <Spinner />
            ) : (
              `Оплатить ${step.type === "deposit" ? "предоплату" : "доплату"} ${money(step.amount)}`
            )}
          </Button>
          {terms.paymentDueAt && (
            <p className="text-center text-xs text-taupe">
              Оплатить до {dueFormatter.format(new Date(terms.paymentDueAt))}
            </p>
          )}
          <OfferAcceptanceNote action="Оплатить" />
        </div>
      )}

      {terms.paymentOverdue && (
        <p className="rounded-xl border border-espresso/15 px-4 py-3 text-sm text-espresso">
          Срок оплаты истёк. Напишите мастеру в{" "}
          <a
            href="https://t.me/Olga_Stariva"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Telegram
          </a>{" "}
          — он продлит его.
        </p>
      )}
    </div>
  );
}
