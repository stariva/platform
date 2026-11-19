import { expect, mock, test } from "bun:test";
import type { CreateProductOrderInput } from "@/lib/commerce/orders";

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
      gift = false,
    ): Promise<string> {
      const id = crypto.randomUUID();
      await db.insert(productOrders).values({
        id,
        kind: "stock",
        status: "paid",
        gift,
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

    // Подарок: ни доступа, ни письма — только один код на купон в коробку,
    // сколько бы раз ни пришёл вебхук
    const giftOrder = await seedOrder(
      `renamed-${run}`,
      `gift-${email}`,
      true,
      true,
    );
    await Promise.all([
      grantKitWorkshops(giftOrder),
      grantKitWorkshops(giftOrder),
    ]);
    await grantKitWorkshops(giftOrder);
    const { workshopAccessCodes } = await import("@stariva/db/schema");
    const { kitCodeNote } = await import("@stariva/web-api");
    const [giftRow] = await db
      .select({ number: productOrders.number })
      .from(productOrders)
      .where(eq(productOrders.id, giftOrder));
    const giftCodes = await db
      .select()
      .from(workshopAccessCodes)
      .where(eq(workshopAccessCodes.note, kitCodeNote(giftRow?.number ?? 0)));
    expect(giftCodes).toHaveLength(1);
    expect(giftCodes[0]).toMatchObject({
      workshopSlug,
      channel: "kit",
      amount: 0,
      redeemedAt: null,
    });
    expect(notify).toHaveBeenCalledTimes(2);
    expect(
      await db
        .select()
        .from(orders)
        .where(eq(orders.workshopSlug, workshopSlug)),
    ).toHaveLength(2);
  },
);

test.skipIf(!process.env.KIT_ACCESS_TEST_DATABASE_URL)(
  "checkout requires a real workshop for each tree kit and gifts issue one code per linked box",
  async () => {
    const url = new URL(process.env.KIT_ACCESS_TEST_DATABASE_URL ?? "");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe("/stariva_kit_access_test");
    process.env.POSTGRES_URL = url.href;

    mock.module("server-only", () => ({}));
    const { db } = await import("@stariva/db");
    const { productOrders, products, workshops, workshopAccessCodes } =
      await import("@stariva/db/schema");
    const { kitCodeNote } = await import("@stariva/web-api");
    const { eq } = await import("drizzle-orm");
    const { countKitGiftCodes, createProductOrder } = await import(
      "@/lib/commerce/orders"
    );
    const { grantKitWorkshops } = await import("./kit-access");

    const run = crypto.randomUUID();
    const firstWorkshop = `first-${run}`;
    const secondWorkshop = `second-${run}`;
    const firstKit = "nabor-makrame-elka-bezhevyy";
    const secondKit = "nabor-makrame-elka-shalfey";
    const contactEmail = `bundle-${run}@example.test`;
    const input = {
      contactName: "Анна",
      contactPhone: "+79001234567",
      contactEmail,
      kitAccessMode: "separate_gifts",
      gift: true,
      items: [
        {
          productSlug: firstKit,
          quantity: 2,
          name: "Бежевый",
          ozonSku: 101,
          price: 180_000,
        },
        {
          productSlug: secondKit,
          quantity: 1,
          name: "Шалфей",
          ozonSku: 102,
          price: 180_000,
        },
      ],
      checkout: null,
      delivery: { method: "pickup", pointId: "1234" },
    } satisfies CreateProductOrderInput;

    await db.insert(workshops).values([
      { slug: firstWorkshop, title: "Первый", category: "interior" },
      { slug: secondWorkshop, title: "Второй", category: "interior" },
    ]);
    await db
      .update(products)
      .set({ workshopSlug: firstWorkshop })
      .where(eq(products.slug, firstKit));
    for (const workshopSlug of [null, `missing-${run}`]) {
      await db
        .update(products)
        .set({ workshopSlug })
        .where(eq(products.slug, secondKit));
      await expect(createProductOrder(input)).rejects.toMatchObject({
        name: "CatalogItemsUnavailableError",
        productSlugs: [secondKit],
      });
      await expect(
        createProductOrder({
          ...input,
          kitAccessMode: undefined,
          items: input.items.filter((item) => item.productSlug === secondKit),
        }),
      ).rejects.toMatchObject({
        name: "CatalogItemsUnavailableError",
        productSlugs: [secondKit],
      });
    }
    expect(
      await db.$count(
        productOrders,
        eq(productOrders.contactEmail, contactEmail),
      ),
    ).toBe(0);

    await db
      .update(products)
      .set({ workshopSlug: secondWorkshop })
      .where(eq(products.slug, secondKit));
    const order = await createProductOrder(input);
    await db
      .update(productOrders)
      .set({ status: "paid" })
      .where(eq(productOrders.id, order.id));
    await db
      .update(products)
      .set({ workshopSlug: null })
      .where(eq(products.slug, secondKit));

    await Promise.all([
      grantKitWorkshops(order.id),
      grantKitWorkshops(order.id),
    ]);
    expect(await countKitGiftCodes(order.number)).toBe(3);
    const codes = await db
      .select({ slug: workshopAccessCodes.workshopSlug })
      .from(workshopAccessCodes)
      .where(eq(workshopAccessCodes.note, kitCodeNote(order.number)));
    expect(codes.filter(({ slug }) => slug === firstWorkshop)).toHaveLength(2);
    expect(codes.filter(({ slug }) => slug === secondWorkshop)).toHaveLength(1);
  },
);
