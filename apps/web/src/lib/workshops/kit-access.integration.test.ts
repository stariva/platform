import { expect, mock, test } from "bun:test";

test.skipIf(!process.env.KIT_ACCESS_TEST_DATABASE_URL)(
  "a paid kit order opens its workshop once and emails the buyer",
  async () => {
    const url = new URL(process.env.KIT_ACCESS_TEST_DATABASE_URL ?? "");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe("/stariva_kit_access_test");
    process.env.POSTGRES_URL = url.href;

    const { db } = await import("@stariva/db");
    const {
      courseAccess,
      orders,
      productOrderItems,
      productOrders,
      products,
      user,
      workshops,
    } = await import("@stariva/db/schema");
    const { eq } = await import("drizzle-orm");

    const notify = mock(async (_orderId: string) => {});
    mock.module("server-only", () => ({}));
    mock.module("./notifications", () => ({ notifyWorkshopBooked: notify }));
    // Гостю аккаунт заводит better-auth — здесь хватит строки в user
    mock.module("./buyer", () => ({
      findOrCreateBuyer: async (email: string, name: string) => {
        // Два вебхука сразу заводят одного покупателя — как в better-auth
        await db
          .insert(user)
          .values({ id: crypto.randomUUID(), name, email })
          .onConflictDoNothing({ target: user.email });
        const [found] = await db
          .select()
          .from(user)
          .where(eq(user.email, email));
        return found;
      },
    }));
    const { grantKitWorkshops } = await import("./kit-access");
    const { kitWorkshopOrderId } = await import("@stariva/web-api");

    const run = crypto.randomUUID();
    const workshopSlug = `workshop-${run}`;
    await db.insert(workshops).values({
      slug: workshopSlug,
      title: "Ёлка макраме",
      category: "interior",
    });
    await db.insert(products).values([
      {
        slug: `kit-${run}`,
        name: "Набор",
        category: "interior",
        subcategory: "kits",
        price: 199_000,
        workshopSlug,
      },
      {
        slug: `plain-${run}`,
        name: "Кашпо",
        category: "interior",
        subcategory: "planters",
        price: 99_000,
      },
    ]);

    async function seedOrder(
      productSlug: string,
      contactEmail: string | null,
      captured = false,
    ): Promise<string> {
      const id = crypto.randomUUID();
      await db.insert(productOrders).values({
        id,
        kind: "stock",
        status: "paid",
        contactName: "Анна",
        contactPhone: "+79001234567",
        contactEmail,
        amountProducts: 199_000,
        amountDelivery: 0,
        amountTotal: 199_000,
        deliveryMethod: "pickup",
        deliveryPointId: "1234",
      });
      await db.insert(productOrderItems).values({
        id: crypto.randomUUID(),
        orderId: id,
        productSlug,
        workshopSlug: captured ? workshopSlug : null,
        workshopLinkCaptured: captured,
        name: "Позиция",
        price: 199_000,
        // Два набора в заказе — мастер-класс всё равно один
        quantity: 2,
      });
      return id;
    }

    const email = `${run}@example.test`;
    const kitOrder = await seedOrder(`kit-${run}`, email);

    // Вебхук ЮKassa и страница заказа могут прийти одновременно и повторно
    await Promise.all([
      grantKitWorkshops(kitOrder),
      grantKitWorkshops(kitOrder),
    ]);
    await grantKitWorkshops(kitOrder);

    const workshopOrderId = kitWorkshopOrderId(kitOrder, workshopSlug);
    const created = await db
      .select()
      .from(orders)
      .where(eq(orders.workshopSlug, workshopSlug));
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      id: workshopOrderId,
      amount: 0,
      status: "paid",
      contactEmail: email,
    });
    expect(created[0]?.accessToken).toBeString();
    expect(created[0]?.attribution?.last.utm_source).toBe("kit");

    const access = await db
      .select()
      .from(courseAccess)
      .where(eq(courseAccess.workshopSlug, workshopSlug));
    expect(access).toHaveLength(1);
    expect(access[0]?.orderId).toBe(workshopOrderId);
    expect(access[0]?.userId).toBe(created[0]?.userId as string);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(workshopOrderId);

    // @stariva/api не входит в зависимости web, и turbo prune не кладёт его в
    // образ. Путь в переменной — чтобы tsc при сборке не искал этот модуль.
    const adminAccessCodes =
      "../../../../../packages/api/src/routers/admin/workshops/access-codes";
    const { orderAccess } = (await import(adminAccessCodes)) as {
      orderAccess: {
        "~orpc": {
          handler: (
            options: Record<string, unknown>,
            input: { orderId: string },
          ) => Promise<{ linked: { slug: string }[]; granted: unknown[] }>;
        };
      };
    };
    const handler = orderAccess["~orpc"].handler;
    const accessFor = (orderId: string) =>
      handler(
        {
          context: { db },
          input: { orderId },
          path: [],
          procedure: orderAccess,
          errors: {},
          lastEventId: undefined,
        },
        { orderId },
      );
    // A captured link survives a catalog rename or replacement.
    const capturedOrder = await seedOrder(
      `kit-${run}`,
      `snapshot-${email}`,
      true,
    );
    await db
      .update(products)
      .set({ workshopSlug: null, slug: `renamed-${run}` })
      .where(eq(products.slug, `kit-${run}`));
    await grantKitWorkshops(capturedOrder);
    expect(
      (await accessFor(capturedOrder)).linked.map(
        (w: { slug: string }) => w.slug,
      ),
    ).toEqual([workshopSlug]);
    expect((await accessFor(capturedOrder)).granted).toHaveLength(1);
    // The old order has no remaining catalog link, but its grant is still visible.
    expect((await accessFor(kitOrder)).linked).toHaveLength(0);
    expect((await accessFor(kitOrder)).granted).toHaveLength(1);
    await grantKitWorkshops(kitOrder);
    expect(notify).toHaveBeenCalledTimes(2);

    // Без почты и без мастер-класса у товара ничего не открываем
    await grantKitWorkshops(await seedOrder(`kit-${run}`, null));
    await grantKitWorkshops(
      await seedOrder(`plain-${run}`, `other-${run}@example.test`),
    );
    expect(
      await db
        .select()
        .from(orders)
        .where(eq(orders.workshopSlug, workshopSlug)),
    ).toHaveLength(2);
    expect(notify).toHaveBeenCalledTimes(2);
  },
);
