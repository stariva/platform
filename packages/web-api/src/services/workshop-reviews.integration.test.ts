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
    // Вклиниться между коммитом сохранения и удалением его старых файлов
    let beforeDelete: (() => Promise<void>) | null = null;
    const storage = await import("@stariva/storage");
    mock.module("@stariva/storage", () => ({
      ...storage,
      isPublicStorageConfigured: () => true,
      uploadPublicObject: async (key: string, bytes: Uint8Array) => {
        // Медленная загрузка, чтобы сохранения из «двух вкладок» пересекались
        await Bun.sleep(5);
        if (bytes[6] === failUploadOf) throw new Error("s3 is down");
        uploadedBytes.push(bytes);
        stored.add(key);
        return `${CDN}${key}`;
      },
      publicObjectKey: (src: string) =>
        src.startsWith(CDN) ? src.slice(CDN.length) : null,
      deletePublicObjects: async (keys: string[]) => {
        const hook = beforeDelete;
        beforeDelete = null;
        if (hook) await hook();
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

    // Минимальный JPEG: APP0 с номером снимка, EXIF с «координатами», данные.
    // Номер (седьмой байт) отличает снимки друг от друга
    const photo = (n: number) =>
      new File(
        [
          new Uint8Array([
            ...[0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, n, 0x00],
            ...[0xff, 0xe1, 0x00, 0x05, 0x47, 0x50, 0x53],
            ...[0xff, 0xda, 0x00, 0x02, 0x01, 0x02, 0xff, 0xd9],
          ]),
        ],
        `${n}.jpg`,
        { type: "image/jpeg" },
      );
    const uploadedBytes: Uint8Array[] = [];
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
    expect(first).toMatchObject({ notify: true });
    const [p1, p2] = (await row()).photos;
    if (!p1 || !p2) throw new Error("photos were not saved");
    expect((await row()).source).toBe("site");
    // В бакет ушли файлы без EXIF: APP1 с «GPS» вырезан
    for (const sent of uploadedBytes) {
      expect(Buffer.from(sent).includes(Buffer.from("GPS"))).toBe(false);
    }
    // Правка сразу следом — без нового сообщения мастеру
    expect(await save([p1, p2])).toMatchObject({
      status: "ok",
      notify: false,
    });

    // Две вкладки: одна убирает второе фото, другая оставляет оба и заново
    // загружает уже бывший в отзыве снимок. Какая бы ни записала последней,
    // в отзыве не должно остаться удалённого файла
    for (let round = 0; round < 5; round++) {
      const current = (await row()).photos;
      await Promise.all([
        save([current[0] as string]),
        save(current, [photo(1)]),
      ]);
      const after = await row();
      expect(after.photos.length).toBeGreaterThan(0);
      for (const src of after.photos) expect(isStored(src)).toBe(true);
      // Оставить два фото для следующего раунда
      await save(after.photos.slice(0, 1), [photo(10 + round)]);
    }

    // Порядок задан хуком: A записал версию без снимка, затем B загрузил тот
    // же снимок заново и записался, и только потом A удаляет свой старый файл
    await save([], [photo(90), photo(91)]);
    const [x90, x91] = (await row()).photos;
    if (!x90 || !x91) throw new Error("photos were not saved");
    beforeDelete = async () => {
      expect(await save([x90], [photo(91)])).toMatchObject({ status: "ok" });
    };
    await save([x90]);
    expect(beforeDelete).toBeNull();
    const afterForced = await row();
    expect(afterForced.photos).toHaveLength(2);
    for (const src of afterForced.photos) expect(isStored(src)).toBe(true);
    expect(isStored(x91)).toBe(false);

    // Параллельно: одно сохранение кладёт снимок, другое с тем же снимком
    // падает на загрузке — сохранённое фото остаётся в бакете
    failUploadOf = 99;
    const [okSave, failedSave] = await Promise.all([
      save([x90], [photo(92)]),
      save([x90], [photo(92), photo(99)]),
    ]);
    failUploadOf = null;
    expect(okSave).toMatchObject({ status: "ok" });
    expect(failedSave).toEqual({ status: "unavailable" });
    for (const src of (await row()).photos) expect(isStored(src)).toBe(true);

    // Админка публикует и держит строку, пока сохранение уже ждёт её: оно
    // дожидается коммита публикации и видит отзыв опубликованным
    const keep = (await row()).photos;
    let releaseAdmin = () => {};
    const adminGate = new Promise<void>((resolve) => {
      releaseAdmin = resolve;
    });
    let adminLocked = () => {};
    const adminHasRow = new Promise<void>((resolve) => {
      adminLocked = resolve;
    });
    const admin = db.transaction(async (tx) => {
      await tx
        .update(reviews)
        .set({ published: true })
        .where(eq(reviews.userId, userId));
      adminLocked();
      await adminGate;
    });
    await adminHasRow;
    const racing = save(keep);
    await Bun.sleep(100);
    releaseAdmin();
    await admin;
    expect(await racing).toMatchObject({ status: "ok", wasPublished: true });
    expect((await row()).published).toBe(false);

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

    // Два первых сохранения разом, строки ещё нет: второе ждёт первое и
    // видит его версию — отзыв один, лишних файлов в бакете не остаётся
    const secondUser = crypto.randomUUID();
    await db.insert(user).values({
      id: secondUser,
      name: "Мария",
      email: `${secondUser}@example.test`,
    });
    const results = await Promise.all([
      saveWorkshopReview({
        ...base,
        userId: secondUser,
        keepPhotos: [],
        photos: [photo(70)],
      }),
      saveWorkshopReview({
        ...base,
        userId: secondUser,
        keepPhotos: [],
        photos: [photo(71)],
      }),
    ]);
    expect(results.map((r) => r.status)).toEqual(["ok", "ok"]);
    // Ровно одно из них создало отзыв, второе его изменило
    expect(results.filter((r) => r.status === "ok" && r.created)).toHaveLength(
      1,
    );
    const rows = await db
      .select()
      .from(reviews)
      .where(eq(reviews.userId, secondUser));
    expect(rows).toHaveLength(1);
    expect(
      new Set(rows[0]?.photos.map((src) => src.slice(CDN.length))),
    ).toEqual(stored);
  },
);
