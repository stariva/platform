import type { VisitorInfo } from "@stariva/db/schema";
import type { CustomOrderServices } from "@stariva/web-api";
import { attributionFromRequest } from "@/lib/campaign-attribution";
import { collectVisitor } from "@/lib/visitor";
import { type OrderRequest, orderRequestSchema } from "./schema";

interface CustomOrderDependencies {
  notificationConfigured: () => boolean;
  saveRequest: (
    data: OrderRequest,
    photo: File | null,
    visitor: VisitorInfo,
  ) => Promise<{ id: string; number: number }>;
  dispatchRequest: (id: string) => Promise<void>;
  /** Отложить работу до конца ответа: `after` из next/server. */
  after: (callback: () => Promise<void>) => void;
}

/**
 * Заявки на изделия для процедуры forms.submitCustomOrder: сохранение и
 * доставка живут в витрине (inbox.ts), здесь — склейка с запросом. Поля
 * уже проверены контрактом; добавляем источник из cookie и данные о
 * посетителе из заголовков.
 */
export function createCustomOrderServices({
  notificationConfigured,
  saveRequest,
  dispatchRequest,
  after,
}: CustomOrderDependencies): CustomOrderServices {
  return {
    isAccepting: notificationConfigured,
    async save(request, photo, headers) {
      // Порядок полей как у схемы: по JSON заявки считается отпечаток повтора
      const data = orderRequestSchema.parse({
        ...request,
        attribution: attributionFromRequest({ headers }) ?? undefined,
      });
      try {
        return await saveRequest(
          data,
          photo,
          await collectVisitor({ headers }),
        );
      } catch (error) {
        if (error instanceof Error && error.message === "request_conflict") {
          return "conflict";
        }
        throw error;
      }
    },
    dispatchLater(id) {
      after(async () => {
        try {
          await dispatchRequest(id);
        } catch {
          // Заявка сохранена: уведомление дошлёт повтор из inbox
          console.error("[custom-order] delivery_deferred", { requestId: id });
        }
      });
    },
  };
}
