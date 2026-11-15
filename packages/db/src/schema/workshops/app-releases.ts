import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Релизы мобильного приложения «Stariva Мастер-классы». Веб-бандл обновляется
 * по воздуху (OTA), а APK ставят вручную, когда нативная часть устарела:
 * `minNativeVersion` — самая старая оболочка, на которой бандл работает.
 */
export const appReleases = pgTable("app_releases", {
  // Версия веб-бандла, «1.4.0» — она же ключ релиза
  version: text("version").primaryKey(),
  // Архив бандла в бакете: его скачивает @capgo/capacitor-updater
  bundleZipUrl: text("bundle_zip_url").notNull(),
  // SHA-256 архива (hex): без него Capgo отказывается скачивать бандл
  bundleChecksum: text("bundle_checksum").notNull().default(""),
  // Старше этой версии оболочки бандл не запустится — приложение просит APK
  minNativeVersion: text("min_native_version").notNull().default("1.0.0"),
  apkDownloadUrl: text("apk_download_url"),
  releaseNotes: text("release_notes").notNull().default(""),
  // Порядок релизов: «последний» — с самым большим номером, не по дате
  buildNumber: integer("build_number").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type AppReleaseRow = typeof appReleases.$inferSelect;
