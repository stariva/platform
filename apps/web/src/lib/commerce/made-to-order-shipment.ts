import {
  createParcelShipment,
  isOzonBusinessDeliveryConfigured,
  type ParcelQuote,
  probeOzonBusinessDelivery,
  quoteParcel,
} from "@/lib/ozon-business-delivery/client";
import {
  isOzonBusinessAccessError,
  isOzonBusinessOutage,
  isOzonBusinessRejection,
  OzonBusinessDeliveryError,
  ParcelNotApprovedError,
} from "@/lib/ozon-business-delivery/errors";
import type { PickupPoint } from "@/lib/ozon-delivery/types";
import { formatPrice } from "@/lib/products";
import {
  notifyMadeToOrderPayment,
  notifyOzonOrderFailed,
  notifyStaffAlert,
} from "./order-notifications";
import {
  attachMadeToOrderShipment,
  claimMadeToOrderShipment,
  getProductOrderById,
  getProductOrderItems,
  listMadeToOrderFallbackPrices,
  listMadeToOrderStuckShipments,
  listOrderPayments,
  type MadeToOrderDeliverySnapshot,
  markMadeToOrderShipmentUnapproved,
  markProductOrderOzonFailed,
  replaceMadeToOrderDeliveryPrice,
  saveMadeToOrderDeliveryPrice,
} from "./orders";

/**
 * Цена-заглушка на время сбоя Ozon Доставки: покупатель не должен ждать,
 * пока чинится интеграция, поэтому доплата открывается с этой стоимостью.
 * До оплаты воркер заменит её реальной (sweepMadeToOrderDeliveries), после
 * оплаты разницу с реальной ценой сообщит уведомление мастеру.
 */
const FALLBACK_DELIVERY_PRICE_KOPECKS = 15_000;

/**
 * Не чаще раза в полчаса: разовый сбой Ozon не должен будить мастера на
 * каждой повторной попытке покупателя, а начавший повторяться — должен.
 */
const FALLBACK_ALERT_INTERVAL_MS = 30 * 60_000;
let lastFallbackAlertAt = 0;

/** Чем кончился расчёт доставки: см. priceMadeToOrderDelivery. */
export type DeliveryPricingResult =
  | "ok"
  | "locked"
  | "unavailable"
  | "quote_failed"
  | "quote_unavailable";

/**
 * Покупатель выбрал пункт при доплате: считает доставку посылки, которую
 * упаковала мастер, до этого пункта и записывает пункт и цену в заказ. Доставка
 * входит в доплату, а после оплаты отправление создаётся в Ozon.
 *
 * `unavailable` — пункт не подходит, покупатель выберет другой.
 * `quote_unavailable` — расчёт не выйдет и повтор не поможет (Ozon не
 * подключён, отклонил запрос или не доставляет этому покупателю): мастер
 * получает алерт и может выставить доплату с ручной доставкой. Сбой самого
 * Ozon (сеть, токен, ключи, их шлюз) покупателя не стопорит: сохраняется
 * цена-заглушка и возвращается `ok`, а воркер догонит реальную цену.
 * `quote_failed` — внутренняя ошибка, покупатель попробует ещё раз.
 * `locked` — заказ уже не ждёт доплаты.
 */
export async function priceMadeToOrderDelivery(
  orderId: string,
  pointId: string,
  point: PickupPoint | null,
): Promise<DeliveryPricingResult> {
  const order = await getProductOrderById(orderId);
  const snapshot =
    order?.checkoutSnapshot as MadeToOrderDeliverySnapshot | null;
  if (
    order?.kind !== "made_to_order" ||
    order.status !== "awaiting_balance" ||
    !snapshot?.parcel
  ) {
    return "locked";
  }

  /** Расчёт не выйдет сам: сообщаем мастеру, покупателю — что повторять не нужно. */
  const failed = async (reason: string): Promise<DeliveryPricingResult> => {
    await notifyStaffAlert(
      `${orderId}/delivery-quote`,
      {
        title: `Заказ №${order.number}: Ozon не посчитал доставку`,
        message: `${reason}\nПокупатель не может оплатить доплату. Укажите стоимость доставки вручную в админке: этап «Ждёт доплату» → «Указать доставку вручную».`,
      },
      "order-delivery-quote",
    );
    return "quote_unavailable";
  };

  if (!isOzonBusinessDeliveryConfigured()) {
    return failed("Ozon Доставка для бизнеса не подключена.");
  }
  try {
    const quote = await quoteParcel({
      recipientPhone: order.contactPhone,
      pointId,
      parcel: snapshot.parcel,
      declaredValueKopecks: order.amountProducts,
    });
    if (!quote.available) {
      // Не подошёл пункт — это решает сам покупатель
      if (quote.cause === "point") return "unavailable";
      return failed(quote.reason ?? "Ozon отказал в расчёте доставки.");
    }
    const saved = await saveMadeToOrderDeliveryPrice(
      orderId,
      pointId,
      point,
      quote.priceKopecks,
    );
    return saved ? "ok" : "locked";
  } catch (error) {
    console.error(
      `[made-to-order] Не удалось посчитать доставку заказа ${orderId}:`,
      error,
    );
    // Ozon недоступен: сети нет, токен не приняли, ключи отозвали или
    // споткнулся их шлюз. Покупателю не отказываем — выставляем цену-заглушку:
    // он платит доплату сейчас, а воркер, когда Ozon оживёт, заменит цену
    // реальной до оплаты или создаст отправление после неё
    if (isOzonBusinessOutage(error)) {
      const saved = await saveMadeToOrderDeliveryPrice(
        orderId,
        pointId,
        point,
        FALLBACK_DELIVERY_PRICE_KOPECKS,
        true,
      );
      if (!saved) return "locked";
      // Единичный сбой не должен будить мастера на каждой повторной попытке
      // покупателя, а начавший повторяться — должен дойти
      if (Date.now() - lastFallbackAlertAt >= FALLBACK_ALERT_INTERVAL_MS) {
        lastFallbackAlertAt = Date.now();
        await notifyStaffAlert(
          `${orderId}/delivery-fallback`,
          {
            title: `Заказ №${order.number}: доставка ${formatPrice(FALLBACK_DELIVERY_PRICE_KOPECKS / 100)} как заглушка`,
            message: `Ozon не ответил при расчёте доставки: ${error instanceof Error ? error.message : String(error)}. Покупателю выставлена временная цена ${formatPrice(FALLBACK_DELIVERY_PRICE_KOPECKS / 100)}, он может оплатить доплату сейчас. Когда Ozon оживёт, задание воркера заменит цену до оплаты, а после оплаты разница придёт отдельным уведомлением. Если такие сообщения приходят регулярно — проверьте ключи и доступы приложения в кабинете Ozon Доставки.`,
          },
          "order-delivery-fallback",
        );
      }
      return "ok";
    }
    // Ozon отклонил сам запрос (например, неподходящие вес и размеры): тот же
    // запрос даст тот же ответ, и мастер должна это увидеть
    if (isOzonBusinessRejection(error)) {
      return failed(
        `Ozon отклонил запрос расчёта (HTTP ${error.status}${error.code ? `, ${error.code}` : ""}): ${error.detail}. Проверьте вес и размеры посылки.`,
      );
    }
    // Сбой связи пройдёт сам: мастера не тревожим, покупатель попробует ещё раз
    return "quote_failed";
  }
}

/**
 * Доплата получена: создаёт и подтверждает отправление Ozon. Покупатель мог
 * платить до трёх дней, поэтому Ozon считаем заново. Разницу в цене с покупателя
 * уже не взять — о ней сообщаем мастеру. Заказ с ручной доставкой не трогаем.
 * Идемпотентно; сбой бросает ошибку, и YooKassa повторит webhook.
 *
 * `balancePaymentId` — оплата доплаты, из-за которой всё началось: если заказ
 * создан в Ozon, но не подтверждён, её уведомление мастеру отправится заново
 * (см. markMadeToOrderShipmentUnapproved).
 */
export async function createMadeToOrderShipment(
  orderId: string,
  balancePaymentId: string,
  options: { alertOnFailure?: boolean } = {},
): Promise<void> {
  const attemptId = await claimMadeToOrderShipment(orderId);
  if (!attemptId) return;

  try {
    const order = await getProductOrderById(orderId);
    const snapshot =
      order?.checkoutSnapshot as MadeToOrderDeliverySnapshot | null;
    if (!order?.deliveryPointId || !snapshot?.parcel) {
      throw new Error("order_without_parcel_or_pickup_point");
    }
    const request = {
      recipientPhone: order.contactPhone,
      pointId: order.deliveryPointId,
      parcel: snapshot.parcel,
      declaredValueKopecks: order.amountProducts,
    };

    const quote = await quoteParcel(request);
    if (!quote.available) throw new Error("ozon_delivery_not_available");

    const items = await getProductOrderItems(orderId);
    const shipment = await createParcelShipment({
      ...request,
      externalOrderId: orderId,
      recipientName: order.contactName,
      items: items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        priceKopecks: item.price,
      })),
    });
    await attachMadeToOrderShipment(
      orderId,
      attemptId,
      shipment.orderId,
      shipment.postingNumbers,
    );

    if (quote.priceKopecks !== order.amountDelivery) {
      await notifyStaffAlert(
        `${orderId}/delivery-price`,
        {
          title: `Заказ №${order.number}: доставка Ozon изменилась`,
          message: `Покупатель оплатил доставку ${formatPrice(order.amountDelivery / 100)}, а Ozon посчитал ${formatPrice(quote.priceKopecks / 100)} на момент отправки.`,
        },
        "order-delivery-price",
      );
    }
  } catch (error) {
    if (error instanceof ParcelNotApprovedError) {
      // Заказ в Ozon уже есть. Повтор webhook создал бы второй, поэтому
      // номера сохраняем и ошибку не бросаем: подтверждает мастер. Сказать ей
      // об этом должно уведомление об оплате: сохранение номеров заодно
      // снимает отметку о нём, и оно уйдёт снова, даже если уже уходило
      console.error(
        `[made-to-order] Заказ ${orderId} создан в Ozon, но не подтверждён:`,
        error,
      );
      await markMadeToOrderShipmentUnapproved(
        orderId,
        attemptId,
        error.parcel.orderId,
        error.parcel.postingNumbers,
        balancePaymentId,
      );
      return;
    }
    console.error(
      `[made-to-order] КРИТИЧНО: заказ ${orderId} оплачен, но отправление Ozon не создано:`,
      error,
    );
    await markProductOrderOzonFailed(orderId, attemptId);
    // Каждая неудачная попытка вебхука — отдельное напоминание мастеру.
    // Повтор из воркера тихий: вебхук уже сообщил, а крон иначе молотил бы
    // мастеру, пока Ozon чинят
    if (options.alertOnFailure !== false) {
      await notifyOzonOrderFailed(orderId);
    }
    throw error;
  }
}

/** Чем кончился прогон догонялки: см. sweepMadeToOrderDeliveries. */
export interface MadeToOrderDeliverySweepResult {
  /** Заказов просмотрено. */
  checked: number;
  /** Заглушки заменены реальной ценой Ozon до оплаты. */
  repriced: number;
  /** Отправления созданы после того, как вебхук не смог. */
  shipped: number;
  /** Не вышло: Ozon ещё не ожил или отказал по бизнес-причине. */
  failed: number;
}

/**
 * Последнее известное состояние Ozon Доставки. Пульс гоняет воркер, алертим
 * только переходы: постоянная поломка не должна будить мастера каждые
 * 10 минут, а напомнить о себе — может, раз в шесть часов.
 */
let ozonDeliveryHealthy: boolean | null = null;
let ozonDeliveryAlertedAt = 0;
const HEALTH_REMINDER_MS = 6 * 60 * 60_000;

/**
 * Пульс Ozon Доставки: до покупателей. Прогон каждые 10 минут щупает обмен
 * ключей и самый дешёвый запрос API и говорит мастеру о переходах — сбой
 * (отозванные ключи, лежащий Ozon) виден раньше, чем покупатель откроет
 * страницу расчёта. Ответ 4xx считает здоровым: запрос дошёл до API и
 * авторизация прошла — это не про доступность (например, их проверка не
 * приняла пробный телефон).
 */
async function reportOzonDeliveryHealth(): Promise<void> {
  // Не подключена — пульс нечего щупать: об этом скажет сам расчёт
  if (!isOzonBusinessDeliveryConfigured()) return;

  let failure: unknown = null;
  try {
    await probeOzonBusinessDelivery();
  } catch (error) {
    const refusedPayload =
      error instanceof OzonBusinessDeliveryError &&
      error.status < 500 &&
      ![401, 403, 408, 429].includes(error.status);
    if (!refusedPayload) failure = error;
  }

  if (!failure) {
    if (ozonDeliveryHealthy === false) {
      ozonDeliveryHealthy = true;
      await notifyStaffAlert(
        `ozon-health/recovered/${Date.now()}`,
        {
          title: "Ozon Доставка ожила",
          message:
            "Расчёт и отправления работают штатно. Заглушки в заказах воркер заменит реальными ценами сам, зависшие отправления создаст.",
        },
        "ozon-health",
      );
    } else {
      ozonDeliveryHealthy = true;
    }
    return;
  }

  const remind =
    ozonDeliveryHealthy !== false ||
    Date.now() - ozonDeliveryAlertedAt >= HEALTH_REMINDER_MS;
  ozonDeliveryHealthy = false;
  if (!remind) return;
  ozonDeliveryAlertedAt = Date.now();

  const detail = failure instanceof Error ? failure.message : String(failure);
  const brokenKeys = isOzonBusinessAccessError(failure);
  await notifyStaffAlert(
    `ozon-health/down/${Date.now()}`,
    {
      title: brokenKeys
        ? "Ozon не принял ключи Доставки"
        : "Ozon Доставка не отвечает",
      message: brokenKeys
        ? `${detail}. Срочно проверьте ключи и доступы приложения в кабинете Ozon Доставки: покупатели пока платят с ценой-заглушкой, но отправления создадутся только после починки. Напишу, когда оживёт.`
        : `${detail}. Похоже, сбой на стороне Ozon. Покупатели не стопорятся: расчёт идёт с ценой-заглушкой, зависшие отправления воркер создаст сам. Напишу, когда оживёт; если сообщение повторится — проверьте кабинет Ozon Доставки.`,
    },
    "ozon-health",
  );
}

/**
 * Догоняет заказы под заказ, которым помешал сбой Ozon Доставки. Зовёт
 * воркер Hatchet каждые 10 минут (jobs.madeToOrder.sweep):
 *
 * — щупает пульс интеграции и говорит мастеру о переходах до покупателей;
 * — заменяет цену-заглушку реальной, пока покупатель не оплатил доплату;
 * — создаёт отправления оплаченных заказов, если вебхук не смог.
 *
 * Прогон идемпотентен и безопасен повтором. Бизнес-отказы Ozon (пункт,
 * получатель, габариты) задание не чинит: оно снимает заглушку с контроля,
 * говорит мастеру один раз, а повтор запроса дал бы тот же отказ.
 */
export async function sweepMadeToOrderDeliveries(): Promise<MadeToOrderDeliverySweepResult> {
  const result: MadeToOrderDeliverySweepResult = {
    checked: 0,
    repriced: 0,
    shipped: 0,
    failed: 0,
  };

  // Пульс сначала: заодно прогревает токен для расчётов ниже
  await reportOzonDeliveryHealth();

  for (const order of await listMadeToOrderFallbackPrices()) {
    result.checked++;
    const snapshot = order.checkoutSnapshot as MadeToOrderDeliverySnapshot;
    // Локальная копия: сужение типа не живёт в замыкании stopChasing
    const pointId = order.deliveryPointId;
    if (!snapshot?.parcel || !pointId) continue;

    /** Ozon ожил, но пересчитать заглушку не вышло: снимаем с контроля. */
    const stopChasing = async (reason: string): Promise<void> => {
      // Цена остаётся прежней: покупатель видел её и мог уже начать оплату.
      // Если оплатит, а отправление не выйдет — вебхук откажет громко, и
      // мастер решит по обстоятельствам (другой пункт, возврат, вручную).
      // Запись связана с пунктом и признаком заглушки: сменил покупатель
      // пункт или расчёт уже не заглушка — ничего не трогаем
      await replaceMadeToOrderDeliveryPrice(
        order.id,
        pointId,
        order.amountDelivery,
        false,
      );
      await notifyStaffAlert(
        `${order.id}/delivery-recheck`,
        {
          title: `Заказ №${order.number}: доставка-заглушка не пересчитывается`,
          message: `${reason}. Покупатель ещё не оплатил доплату — проверьте заказ в админке: возможно, нужен другой пункт или ручная доставка.`,
        },
        "order-delivery-recheck",
      );
    };

    let quote: ParcelQuote;
    try {
      quote = await quoteParcel({
        recipientPhone: order.contactPhone,
        pointId,
        parcel: snapshot.parcel,
        declaredValueKopecks: order.amountProducts,
      });
    } catch (error) {
      // Ozon ещё не ожил: заглушка остаётся, следующий прогон повторит
      if (isOzonBusinessOutage(error)) {
        result.failed++;
        continue;
      }
      await stopChasing(
        `Расчёт доставки упал: ${error instanceof Error ? error.message : String(error)}`,
      );
      result.failed++;
      continue;
    }

    if (quote.available) {
      const saved = await replaceMadeToOrderDeliveryPrice(
        order.id,
        pointId,
        quote.priceKopecks,
        false,
      );
      if (saved) result.repriced++;
      continue;
    }
    await stopChasing(quote.reason ?? "Ozon отказал в расчёте доставки");
    result.failed++;
  }

  for (const { id } of await listMadeToOrderStuckShipments()) {
    result.checked++;
    // Оплата нужна для повторного уведомления о неподтверждённом заказе
    // (markMadeToOrderShipmentUnapproved): берём последнюю успешную доплату
    const payments = await listOrderPayments(id);
    const balance = payments
      .filter(
        (payment) =>
          payment.type === "balance" && payment.status === "succeeded",
      )
      .sort(
        (a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0),
      )[0];
    if (!balance) {
      console.error(
        `[made-to-order] У заказа ${id} нет оплаченной доплаты, повторить отправление не получится`,
      );
      result.failed++;
      continue;
    }
    try {
      // Вебхук об этой неудаче уже сообщил громко: повтор тихий
      await createMadeToOrderShipment(id, balance.id, {
        alertOnFailure: false,
      });
    } catch {
      // Ждём следующего прогона: Ozon ещё не ожил или отказал по-деловому,
      // в обоих случаях мастер уже в курсе
      result.failed++;
      continue;
    }
    // Отправление создано или сохранено как неподтверждённое: уведомление
    // об оплате само различит эти случаи (дедуп по оплате в базе).
    // Неподтверждённое мастер должна узнать и без вебхука YooKassa —
    // его повторы к этому моменту уже закончились
    await notifyMadeToOrderPayment(balance.id).catch((error: unknown) => {
      console.error(
        `[made-to-order] Не удалось повторно уведомить мастера об оплате ${balance.id}:`,
        error,
      );
    });
    result.shipped++;
  }

  return result;
}
