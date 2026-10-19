import { SELLER_INN } from "@stariva/config/seller";
import { db } from "@stariva/db";
import { npdIncomeRequests, orderReceipts } from "@stariva/db/schema";
import { sendReceiptEmail } from "@stariva/emails";
import {
  detectImageType,
  isPublicStorageConfigured,
  receiptImageKey,
  uploadPublicObject,
} from "@stariva/storage";
import { count, eq } from "drizzle-orm";
import { notifyStaffAlert } from "@/lib/commerce/order-notifications";
import type { YooKassaPayment } from "@/lib/payments/yookassa";
import {
  createIncome,
  isNpdConfigured,
  NpdError,
  type NpdService,
  receiptPrintUrl,
} from "./client";

export interface NpdReceiptInput {
  payment: YooKassaPayment;
  target: { kind: "product" | "workshop"; orderId: string };
  /** Строки чека; в сумме должны давать ровно сумму платежа. */
  services: NpdService[];
  /** Кому письмо с чеком и «по заказу №1042» — за что он. */
  email: { to: string | null; subject: string };
  /**
   * Сколько чеков должно быть у заказа вместе с этим. Если столько уже
   * привязано — мастер сделала чек сама (оплата до автоматических чеков),
   * второй не выписываем.
   */
  expected: number;
}

/**
 * Выписывает чек НПД на успешный платёж и отправляет его покупателю.
 * Один платёж — один чек: повторный вызов ничего не делает. Никогда не
 * бросает — чек не должен ломать обработку оплаты. Если сделать чек не
 * вышло, мастер получает алерт и привязывает чек вручную в админке.
 */
export async function issueNpdReceipt(input: NpdReceiptInput): Promise<void> {
  if (!isNpdConfigured()) return;
  const { payment } = input;
  try {
    if ((await countReceipts(input.target)) >= input.expected) return;
    if (!(await claim(payment.id))) return;

    const total = input.services.reduce(
      (sum, s) => sum + s.amount * s.quantity,
      0,
    );
    if ((total / 100).toFixed(2) !== payment.amount.value) {
      await fail(
        input,
        "not_created",
        `строки чека дают ${(total / 100).toFixed(2)} ₽, а оплачено ${payment.amount.value} ₽`,
      );
      return;
    }

    let number: string;
    try {
      number = await createIncome({
        services: input.services,
        operationTime: new Date(
          payment.captured_at ?? payment.created_at ?? Date.now(),
        ),
      });
    } catch (error) {
      const outcome = error instanceof NpdError ? error.outcome : "unknown";
      await fail(input, outcome, String((error as Error).message ?? error));
      return;
    }
    await record(input, number);
  } catch (error) {
    console.error(
      `[npd] Сбой автоматического чека по платежу ${payment.id}:`,
      error,
    );
  }
}

async function countReceipts({ kind, orderId }: NpdReceiptInput["target"]) {
  const [row] = await db
    .select({ total: count() })
    .from(orderReceipts)
    .where(
      kind === "product"
        ? eq(orderReceipts.productOrderId, orderId)
        : eq(orderReceipts.workshopOrderId, orderId),
    );
  return row?.total ?? 0;
}

/**
 * Занимает платёж под чек — один раз. После любого сбоя чек делает мастер
 * вручную, и сайт не пробует снова: иначе мог бы выписать второй чек к
 * тому, что мастер уже привязала.
 */
async function claim(paymentId: string): Promise<boolean> {
  const rows = await db
    .insert(npdIncomeRequests)
    .values({ paymentId, status: "issuing" })
    .onConflictDoNothing()
    .returning({ paymentId: npdIncomeRequests.paymentId });
  return rows.length > 0;
}

async function record(input: NpdReceiptInput, number: string) {
  const { payment, target } = input;
  const url = receiptPrintUrl(number);
  let receiptId: string;
  try {
    const imageUrl = await storeCopy(number, url);
    const [receipt] = await db
      .insert(orderReceipts)
      .values({
        productOrderId: target.kind === "product" ? target.orderId : null,
        workshopOrderId: target.kind === "workshop" ? target.orderId : null,
        inn: SELLER_INN,
        number,
        url,
        imageUrl,
      })
      .returning();
    if (!receipt) throw new Error("order_receipt_insert_failed");
    receiptId = receipt.id;
    await db
      .update(npdIncomeRequests)
      .set({ status: "issued", receiptId, updatedAt: new Date() })
      .where(eq(npdIncomeRequests.paymentId, payment.id));
    console.info(
      `[npd] Чек ${number} выписан по платежу ${payment.id} (${target.kind} ${target.orderId})`,
    );

    if (!input.email.to) return;
    await sendReceiptEmail({
      to: input.email.to,
      subject: input.email.subject,
      receiptNumber: number,
      receiptUrl: imageUrl ?? url,
    });
    await db
      .update(orderReceipts)
      .set({ emailedAt: new Date(), emailedTo: input.email.to })
      .where(eq(orderReceipts.id, receiptId));
  } catch (error) {
    // Чек в ФНС уже есть — номер должен остаться хотя бы в логе и у мастера
    console.error(
      `[npd] КРИТИЧНО: чек ${number} по платежу ${payment.id} выписан, но не сохранён или не отправлен:`,
      error,
    );
    await notifyStaffAlert(
      payment.id,
      {
        title: "Чек выписан, но не дошёл до покупателя",
        message: `Чек ${url} по ${input.email.subject} есть в «Мой налог», но сайт не смог сохранить его или отправить письмо. Проверьте карточку заказа в админке.`,
      },
      "npd-receipt-unsaved",
    );
  }
}

/**
 * Копия картинки чека в нашем бакете: ФНС отдаёт картинку не всегда, а
 * покупатель должен её увидеть. Чек только что выписан, и картинка может
 * появиться не сразу, поэтому пробуем несколько раз. Не вышло — null,
 * письмо уйдёт со ссылкой на ФНС.
 */
async function storeCopy(number: string, url: string): Promise<string | null> {
  if (!isPublicStorageConfigured()) return null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) {
        const image = new Uint8Array(await res.arrayBuffer());
        const contentType = detectImageType(image);
        if (contentType) {
          return await uploadPublicObject(
            receiptImageKey(SELLER_INN, number, contentType),
            image,
            contentType,
          );
        }
      } else {
        await res.body?.cancel();
      }
    } catch (error) {
      console.warn(`[npd] Картинка чека ${number}, попытка ${attempt}:`, error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
  }
  return null;
}

async function fail(
  input: NpdReceiptInput,
  outcome: NpdError["outcome"],
  reason: string,
) {
  const { payment } = input;
  console.error(
    `[npd] Чек по платежу ${payment.id} не выписан (${outcome}): ${reason}`,
  );
  await db
    .update(npdIncomeRequests)
    .set({
      status: outcome === "unknown" ? "unknown" : "failed",
      error: reason,
      updatedAt: new Date(),
    })
    .where(eq(npdIncomeRequests.paymentId, payment.id));
  const amount = `${payment.amount.value} ₽`;
  await notifyStaffAlert(
    `${payment.id}/${Date.now()}`,
    outcome === "unknown"
      ? {
          title: "Проверьте чек в «Мой налог»",
          message: `Оплата ${amount} по ${input.email.subject}: «Мой налог» не ответил вовремя (${reason}), чек мог выписаться. Если в «Мой налог» его нет — сформируйте чек и вставьте ссылку в карточке заказа. Если есть — просто вставьте ссылку.`,
        }
      : {
          title: "Чек не выписан автоматически",
          message: `Оплата ${amount} по ${input.email.subject}: ${reason}. Сформируйте чек в «Мой налог» и вставьте ссылку в карточке заказа.`,
        },
    "npd-receipt-failed",
  );
}
