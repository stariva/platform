import { expect, mock, test } from "bun:test";

// Мигрированная одноразовая база: `bun run test:integration`
// (scripts/test-integration.ts) готовит её сам.
test.skipIf(!process.env.WORKSHOP_REVIEW_TEST_DATABASE_URL)(
  "saving a review never leaves it pointing at a deleted photo",
  async () => {
    const url = new URL(process.env.WORKSHOP_REVIEW_TEST_DATABASE_URL ?? "");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe("/stariva_workshop_review_test");
    process.env.POSTGRES_URL = url.href;

    const CDN = "https://cdn.example.test/";
    const stored = new Set<string>();
    const deleted: string[] = [];
    let failUploadOf: number | null = null;
    const storage = await import("@stariva/storage");
    mock.module("@stariva/storage", () => ({
      ...storage,
      isPublicStorageConfigured: () => true,
      uploadPublicObject: async (key: string, bytes: Uint8Array) => {
        // Медленная загрузка, чтобы сохранения из «двух вкладок» пересекались
        await Bun.sleep(5);
        if (bytes[3] === failUploadOf) throw new Error("s3 is down");
        stored.add(key);
        return `${CDN}${key}`;
      },
      publicObjectKey: (src: string) =>
        src.startsWith(CDN) ? src.slice(CDN.length) : null,
      deletePublicObjects: async (keys: string[]) => {
        for (const key of keys) {
          stored.delete(key);
          deleted.push(key);
        }
      },
    }));

    const { db, eq } = await import("@stariva/db");
    const { reviews, user, workshops } = await import("@stariva/db/schema");
    const { saveWorkshopReview } = await import("./workshop-reviews");

    const workshopSlug = `review-test-${crypto.randomUUID()}`;
    await db.insert(workshops).values({
      slug: workshopSlug,
      title: "Ёлка макраме",
      category: "interior",
      status: "published",
    });
    const userId = crypto.randomUUID();
    await db
      .insert(user)
      .values({ id: userId, name: "Анна", email: `${userId}@example.test` });

    // JPEG по сигнатуре; четвёртый байт отличает снимки друг от друга
    const photo = (n: number) =>
      new File([new Uint8Array([0xff, 0xd8, 0xff, n, 1, 2, 3])], `${n}.jpg`, {
        type: "image/jpeg",
      });
    const base = {
      userId,
      workshopSlug,
      rating: 5,
      text: "Сплела ёлку за вечер",
      reviewerName: "Анна",
    };
    const save = (keepPhotos: string[], photos: File[] = []) =>
      saveWorkshopReview({ ...base, keepPhotos, photos });
    const row = async () => {
      const [r] = await db
        .select()
        .from(reviews)
        .where(eq(reviews.userId, userId));
      if (!r) throw new Error("review is missing");
      return r;
    };
    const isStored = (src: string) => stored.has(src.slice(CDN.length));

    const first = await save([], [photo(1), photo(2)]);
    expect(first).toMatchObject({ status: "ok", created: true });
    const [p1, p2] = (await row()).photos;
    if (!p1 || !p2) throw new Error("photos were not saved");
    expect((await row()).source).toBe("site");

    // Две вкладки: одна убирает второе фото, другая оставляет оба. Какая бы
    // ни записала последней, в отзыве не должно остаться удалённого файла
    for (let round = 0; round < 5; round++) {
      const current = (await row()).photos;
      await Promise.all([save([current[0] as string]), save(current)]);
      const after = await row();
      expect(after.photos.length).toBeGreaterThan(0);
      for (const src of after.photos) expect(isStored(src)).toBe(true);
      // Вернуть второе фото для следующего раунда
      if (after.photos.length === 1) {
        await save(after.photos, [photo(10 + round)]);
      }
    }

    // Сбой одной загрузки: остальные новые файлы убираются, отзыв прежний
    const beforeFailure = await row();
    const storedBefore = new Set(stored);
    failUploadOf = 99;
    const failed = await save(beforeFailure.photos.slice(0, 1), [
      photo(50),
      photo(99),
    ]);
    failUploadOf = null;
    expect(failed).toEqual({ status: "unavailable" });
    expect((await row()).photos).toEqual(beforeFailure.photos);
    expect(stored).toEqual(storedBefore);

    // Правка опубликованного отзыва снимает его с сайта
    await db
      .update(reviews)
      .set({ published: true })
      .where(eq(reviews.userId, userId));
    const edited = await save([], []);
    expect(edited).toMatchObject({
      status: "ok",
      created: false,
      wasPublished: true,
    });
    expect((await row()).published).toBe(false);
    // Фото убраны из отзыва — и из бакета
    expect(stored.size).toBe(0);
    expect(deleted).toContain(p1.slice(CDN.length));
  },
);
