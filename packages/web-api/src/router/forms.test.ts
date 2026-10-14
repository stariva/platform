import { expect, test } from "bun:test";
import type { CustomOrderRequest } from "../contract";
import type { CustomOrderServices } from "../orpc";

const { safe } = await import("@orpc/client");
const {
  CustomOrderConflictError,
  CustomOrderSaveFailedError,
  CustomOrderUnavailableError,
  NewsletterFailedError,
} = await import("../contract");
const { lastStatus, wireClient } = await import("../testing/wire-client");

const requestId = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const order = {
  requestId,
  contact: "test@example.test",
  description: "Абажур по размерам",
  personalDataConsent: "true" as const,
};

function customOrders(
  overrides: Partial<CustomOrderServices> = {},
): CustomOrderServices & {
  saved: Array<{ request: CustomOrderRequest; photo: File | null }>;
  dispatched: string[];
} {
  const saved: Array<{ request: CustomOrderRequest; photo: File | null }> = [];
  const dispatched: string[] = [];
  return {
    saved,
    dispatched,
    isAccepting: () => true,
    save: async (request, photo) => {
      saved.push({ request, photo });
      return { id: requestId, number: 1042 };
    },
    dispatchLater: (id) => {
      dispatched.push(id);
    },
    ...overrides,
  };
}

/** Текст, который клиент покажет посетителю: первая ошибка в данных. */
function firstIssue(error: unknown): string | undefined {
  const issues = (error as { data?: { issues?: Array<{ message: string }> } })
    ?.data?.issues;
  return issues?.[0]?.message;
}

test("form token comes from the storefront", async () => {
  const client = wireClient({ services: { issueFormToken: async () => "t1" } });
  expect(await client.forms.formToken()).toEqual({ token: "t1" });
});

test("newsletter needs both consents", async () => {
  const sent: string[] = [];
  const client = wireClient({
    services: { subscribeToNewsletter: async (email) => void sent.push(email) },
  });
  const [error] = await safe(
    client.forms.subscribeNewsletter({
      email: "olga@example.test",
      personalDataConsent: true,
      marketingConsent: false as true,
    }),
  );
  expect(error).toMatchObject({ code: "BAD_REQUEST" });
  expect(firstIssue(error)).toBe("Нужно согласие на получение рассылки");
  expect(sent).toEqual([]);
});

test("newsletter subscription notifies the master", async () => {
  const sent: Array<[string, string | undefined]> = [];
  const client = wireClient({
    services: {
      subscribeToNewsletter: async (email, source) =>
        void sent.push([email, source]),
    },
  });
  await client.forms.subscribeNewsletter({
    email: "olga@example.test",
    source: "blog",
    personalDataConsent: true,
    marketingConsent: true,
  });
  expect(sent).toEqual([["olga@example.test", "blog"]]);
});

test("newsletter delivery failure is a typed error", async () => {
  const client = wireClient({
    services: {
      subscribeToNewsletter: async () => {
        throw new Error("telegram_message_failed_500");
      },
    },
  });
  const [error] = await safe(
    client.forms.subscribeNewsletter({
      email: "olga@example.test",
      personalDataConsent: true,
      marketingConsent: true,
    }),
  );
  expect(error).toBeInstanceOf(NewsletterFailedError);
  expect(String(error)).not.toContain("telegram_message_failed");
  expect(lastStatus()).toBe(502);
});

test("acknowledges a saved request; notification goes after the answer", async () => {
  const orders = customOrders();
  const result = await wireClient({
    services: { customOrders: orders },
  }).forms.submitCustomOrder(order);
  expect(result).toEqual({ requestId, requestNumber: 1042 });
  expect(orders.saved).toHaveLength(1);
  expect(orders.saved[0]?.request).toEqual({ ...order, name: "" });
  expect(orders.saved[0]?.photo).toBeNull();
  expect(orders.dispatched).toEqual([requestId]);
});

test("a database failure never claims success or starts delivery", async () => {
  const orders = customOrders({
    save: async () => {
      throw new Error("db down: contact test@example.test");
    },
  });
  const [error] = await safe(
    wireClient({ services: { customOrders: orders } }).forms.submitCustomOrder(
      order,
    ),
  );
  expect(error).toBeInstanceOf(CustomOrderSaveFailedError);
  expect(String(error)).not.toContain("test@example.test");
  expect(lastStatus()).toBe(503);
  expect(orders.dispatched).toEqual([]);
});

test("unconfigured channels fail explicitly", async () => {
  const orders = customOrders({ isAccepting: () => false });
  const [error] = await safe(
    wireClient({ services: { customOrders: orders } }).forms.submitCustomOrder(
      order,
    ),
  );
  expect(error).toBeInstanceOf(CustomOrderUnavailableError);
  expect(lastStatus()).toBe(503);
  expect(orders.saved).toEqual([]);
});

test("idempotency conflicts do not acknowledge another payload", async () => {
  const orders = customOrders({ save: async () => "conflict" });
  const [error] = await safe(
    wireClient({ services: { customOrders: orders } }).forms.submitCustomOrder(
      order,
    ),
  );
  expect(error).toBeInstanceOf(CustomOrderConflictError);
  expect(lastStatus()).toBe(409);
  expect(orders.dispatched).toEqual([]);
});

test("invalid consent, empty contact and honeypot never persist", async () => {
  const orders = customOrders();
  const client = wireClient({ services: { customOrders: orders } });
  const cases = [
    [
      { personalDataConsent: "false" },
      "Нужно согласие на обработку персональных данных",
    ],
    [{ contact: "  " }, "Укажите контакт для связи"],
  ] as const;
  for (const [patch, message] of cases) {
    const [error] = await safe(
      client.forms.submitCustomOrder({ ...order, ...patch } as typeof order),
    );
    expect(firstIssue(error)).toBe(message);
  }
  const [bot] = await safe(
    client.forms.submitCustomOrder({ ...order, website: "https://spam" }),
  );
  expect(bot).toMatchObject({
    code: "BAD_REQUEST",
    message: "Не удалось принять заявку",
  });
  expect(orders.saved).toEqual([]);
});

test("rejects oversized and unsupported photos before persistence", async () => {
  const orders = customOrders();
  const client = wireClient({ services: { customOrders: orders } });
  const big = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "big.jpg", {
    type: "image/jpeg",
  });
  const svg = new File(["<svg/>"], "x.svg", { type: "image/svg+xml" });
  const [tooBig] = await safe(
    client.forms.submitCustomOrder({ ...order, photo: big }),
  );
  expect(firstIssue(tooBig)).toBe(
    "Фото слишком большое. Выберите файл до 8 МБ.",
  );
  const [wrongType] = await safe(
    client.forms.submitCustomOrder({ ...order, photo: svg }),
  );
  expect(firstIssue(wrongType)).toBe(
    "Выберите фото в формате JPG, PNG или WebP.",
  );
  expect(orders.saved).toEqual([]);

  const photo = new File([new Uint8Array(10)], "ok.png", { type: "image/png" });
  await client.forms.submitCustomOrder({ ...order, photo });
  expect(orders.saved[0]?.photo?.type).toBe("image/png");
  expect(orders.saved[0]?.photo?.size).toBe(10);
});
