import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@stariva/config";

/**
 * S3-совместимые хранилища. «yandex» — основной бакет (переменные AWS_*),
 * «vkcloud» — зеркало в VK Cloud Hotbox (переменные VK_S3_*). Ключи объектов
 * одинаковые, поэтому файл можно читать из любого, где он уже есть.
 */
export type StorageProvider = "yandex" | "vkcloud";

/** Активное хранилище: сюда пишут загрузки, отсюда читают по умолчанию. */
export function activeStorageProvider(): StorageProvider {
  return env.STORAGE_PROVIDER;
}

/**
 * Хранилище, из которого зрители смотрят видеоуроки. По умолчанию активное;
 * STORAGE_VIDEO_READ_PROVIDER задаёт отдельное хранилище для видео, не
 * трогая материалы и загрузки. Просмотр из зеркала возможен только после
 * того, как синхронизация скопировала туда файлы.
 */
export function videoStorageProvider(): StorageProvider {
  return env.STORAGE_VIDEO_READ_PROVIDER ?? activeStorageProvider();
}

/** Второе хранилище — зеркало активного (куда копирует jobs.storage.mirrorSync). */
export function otherStorageProvider(
  provider: StorageProvider,
): StorageProvider {
  return provider === "yandex" ? "vkcloud" : "yandex";
}

interface ProviderConfig {
  endpoint?: string;
  forcePathStyle: boolean;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
}

/** Настройки провайдера из окружения; пустое значение — как не заданное. */
function providerConfig(provider: StorageProvider): ProviderConfig {
  if (provider === "vkcloud") {
    return {
      endpoint: env.VK_S3_ENDPOINT,
      forcePathStyle: env.VK_S3_FORCE_PATH_STYLE !== "false",
      region: env.VK_S3_REGION,
      accessKeyId: env.VK_S3_ACCESS_KEY_ID || undefined,
      secretAccessKey: env.VK_S3_SECRET_ACCESS_KEY || undefined,
      bucket: env.VK_S3_BUCKET || undefined,
    };
  }
  return {
    endpoint: env.AWS_S3_ENDPOINT,
    forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE !== "false",
    region: env.AWS_REGION,
    accessKeyId: env.AWS_ACCESS_KEY_ID || undefined,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY || undefined,
    bucket: env.AWS_S3_BUCKET || undefined,
  };
}

/** Заданы ли ключи и закрытый бакет провайдера. */
export function isProviderConfigured(provider: StorageProvider): boolean {
  const config = providerConfig(provider);
  return Boolean(config.accessKeyId && config.secretAccessKey && config.bucket);
}

/** Whether the active storage provider is configured for this environment. */
export function isStorageConfigured(): boolean {
  return isProviderConfigured(activeStorageProvider());
}

const cachedClients = new Map<StorageProvider, S3Client>();

/**
 * Клиент провайдера, создаётся лениво: импорт модуля не падает, когда ключи
 * ещё не настроены (локальная разработка без хранилища). forcePathStyle —
 * по умолчанию: MinIO, Яндекс и Hotbox VK Cloud дружат с path-style.
 */
function getProviderClient(provider: StorageProvider): S3Client {
  const cached = cachedClients.get(provider);
  if (cached) return cached;

  const { accessKeyId, secretAccessKey, endpoint, forcePathStyle, region } =
    providerConfig(provider);
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      `S3 credentials for ${provider} are required (access key id and secret)`,
    );
  }

  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    // Presigned PUT has no Body yet. With the SDK default, its URL contains
    // CRC32 for an empty payload, so uploading a real file fails with HTTP 400.
    requestChecksumCalculation: "WHEN_REQUIRED",
    ...(endpoint ? { endpoint, forcePathStyle } : {}),
  });
  cachedClients.set(provider, client);
  return client;
}

/** Закрытый бакет провайдера; без него читать и писать нечего. */
function requireBucket(provider: StorageProvider): string {
  const bucket = providerConfig(provider).bucket;
  if (!bucket) throw new Error(`S3 bucket for ${provider} is not configured`);
  return bucket;
}

export async function createPresignedUrl(
  key: string,
  provider: StorageProvider = activeStorageProvider(),
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: requireBucket(provider),
    Key: key,
    ContentType: "application/octet-stream",
  });

  return getSignedUrl(getProviderClient(provider), command, {
    expiresIn: 3600,
  }); // 1 hour
}

/**
 * Ссылка для загрузки файла напрямую из браузера в закрытый бакет (PUT).
 * Видео слишком большие, чтобы гнать их через сервер приложения. Content-Type
 * подписывается — браузер обязан отправить тот же.
 */
export async function createUploadUrl(
  key: string,
  contentType: string,
  options?: {
    expiresIn?: number;
    contentLength?: number;
    provider?: StorageProvider;
  },
): Promise<string> {
  const provider = options?.provider ?? activeStorageProvider();
  const command = new PutObjectCommand({
    Bucket: requireBucket(provider),
    Key: key,
    ContentType: contentType,
    ContentLength: options?.contentLength,
  });
  return getSignedUrl(getProviderClient(provider), command, {
    expiresIn: options?.expiresIn ?? 3 * 3600,
  });
}

export function generateS3Key(originalKey: string, temporary = false): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const prefix = temporary ? "temp" : "uploads";

  return `${prefix}/${timestamp}-${randomId}-${originalKey}`;
}

export async function uploadBufferToS3(
  key: string,
  body: Buffer | Uint8Array,
  contentType?: string,
  provider: StorageProvider = activeStorageProvider(),
): Promise<{ key: string; bucket: string; etag?: string }> {
  const bucket = requireBucket(provider);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType ?? "application/octet-stream",
  });
  try {
    const res = await getProviderClient(provider).send(command);
    return { key, bucket, etag: res.ETag };
  } catch (err) {
    const e = err as Error;
    console.error("S3 upload failed", {
      provider,
      bucket,
      key,
      error: e?.message ?? String(err),
      stack: e?.stack,
    });
    throw new Error(
      `Failed to upload to ${provider} bucket '${bucket}' key '${key}': ${e?.message ?? String(err)}`,
    );
  }
}

// ─── Публичный бакет (фото каталога) ─────────────────────────────────────────
// Живёт только в Яндексе: адреса фото хранятся в базе, поэтому переключение
// хранилища их не трогает — за ними сайт всегда ходит в AWS_S3_PUBLIC_BUCKET.

/** Задан публичный бакет и ключи — можно выкладывать фото каталога. */
export function isPublicStorageConfigured(): boolean {
  return Boolean(isProviderConfigured("yandex") && env.AWS_S3_PUBLIC_BUCKET);
}

/** Постоянный публичный адрес файла из публичного бакета. */
export function publicObjectUrl(key: string): string {
  const base =
    env.AWS_S3_PUBLIC_URL ??
    `${env.AWS_S3_ENDPOINT ?? "https://storage.yandexcloud.net"}/${env.AWS_S3_PUBLIC_BUCKET}`;
  return `${base.replace(/\/+$/, "")}/${key}`;
}

/**
 * Кладёт файл в публичный бакет. Ключ должен меняться вместе с содержимым
 * (например, хеш в имени): файл кэшируется браузерами навсегда.
 */
export async function uploadPublicObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const bucket = env.AWS_S3_PUBLIC_BUCKET;
  if (!bucket) throw new Error("AWS_S3_PUBLIC_BUCKET is not configured");

  await getProviderClient("yandex").send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return publicObjectUrl(key);
}

/** Ключ файла публичного бакета по его адресу; null — адрес не из нашего бакета. */
export function publicObjectKey(url: string): string | null {
  const base = publicObjectUrl("");
  return url.startsWith(base) && url.length > base.length
    ? url.slice(base.length)
    : null;
}

/** Удаляет файлы из публичного бакета (до 1000 за раз — предел S3). */
export async function deletePublicObjects(keys: string[]): Promise<void> {
  const bucket = env.AWS_S3_PUBLIC_BUCKET;
  if (!bucket) throw new Error("AWS_S3_PUBLIC_BUCKET is not configured");
  if (keys.length === 0) return;

  const res = await getProviderClient("yandex").send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.slice(0, 1000).map((Key) => ({ Key })),
        Quiet: true,
      },
    }),
  );
  if (res.Errors?.length) {
    const [first] = res.Errors;
    throw new Error(
      `S3 delete failed for ${res.Errors.length} keys, e.g. ${first?.Key}: ${first?.Code}`,
    );
  }
}

/** Текст небольшого файла из закрытого бакета (например, плейлиста HLS). */
export async function getObjectText(
  key: string,
  provider: StorageProvider = activeStorageProvider(),
): Promise<string> {
  const res = await getProviderClient(provider).send(
    new GetObjectCommand({ Bucket: requireBucket(provider), Key: key }),
  );
  if (!res.Body) throw new Error(`empty object: ${key}`);
  return res.Body.transformToString("utf-8");
}

/** Содержимое файла из закрытого бакета целиком (например, PDF во вложение письма). */
export async function getObjectBytes(
  key: string,
  provider: StorageProvider = activeStorageProvider(),
): Promise<Buffer> {
  const res = await getProviderClient(provider).send(
    new GetObjectCommand({ Bucket: requireBucket(provider), Key: key }),
  );
  if (!res.Body) throw new Error(`empty object: ${key}`);
  return Buffer.from(await res.Body.transformToByteArray());
}

/** Файл из закрытого бакета потоком — отдать через сайт, не держа в памяти. */
export async function getObjectStream(
  key: string,
  provider: StorageProvider = activeStorageProvider(),
): Promise<{
  body: ReadableStream;
  contentLength?: number;
}> {
  const res = await getProviderClient(provider).send(
    new GetObjectCommand({ Bucket: requireBucket(provider), Key: key }),
  );
  if (!res.Body) throw new Error(`empty object: ${key}`);
  return {
    body: res.Body.transformToWebStream(),
    contentLength: res.ContentLength,
  };
}

/** Есть ли файл в закрытом бакете провайдера. */
export async function objectExists(
  key: string,
  provider: StorageProvider = activeStorageProvider(),
): Promise<boolean> {
  try {
    await getProviderClient(provider).send(
      new HeadObjectCommand({ Bucket: requireBucket(provider), Key: key }),
    );
    return true;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (status === 404) return false;
    throw error;
  }
}

/** Время загрузки файла в закрытый бакет; null — файла нет. */
export async function objectLastModified(
  key: string,
  provider: StorageProvider = activeStorageProvider(),
): Promise<Date | null> {
  try {
    const res = await getProviderClient(provider).send(
      new HeadObjectCommand({ Bucket: requireBucket(provider), Key: key }),
    );
    return res.LastModified ?? null;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw error;
  }
}

/** Файл в закрытом бакете: ключ, размер и время загрузки. */
export interface StoredObject {
  key: string;
  size: number;
  lastModified: Date;
}

/** Все файлы закрытого бакета провайдера под префиксом (постранично, по 1000). */
export async function listObjects(
  prefix: string,
  provider: StorageProvider = activeStorageProvider(),
): Promise<StoredObject[]> {
  const objects: StoredObject[] = [];
  let token: string | undefined;
  do {
    const res = await getProviderClient(provider).send(
      new ListObjectsV2Command({
        Bucket: requireBucket(provider),
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const item of res.Contents ?? []) {
      if (!item.Key) continue;
      objects.push({
        key: item.Key,
        size: item.Size ?? 0,
        lastModified: item.LastModified ?? new Date(0),
      });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return objects;
}

/** Удаляет файлы из закрытого бакета пачками по 1000 (предел S3). */
export async function deleteObjects(
  keys: string[],
  provider: StorageProvider = activeStorageProvider(),
): Promise<void> {
  if (keys.length === 0) return;
  const bucket = requireBucket(provider);
  for (let i = 0; i < keys.length; i += 1000) {
    const res = await getProviderClient(provider).send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
    if (res.Errors?.length) {
      const [first] = res.Errors;
      throw new Error(
        `S3 delete failed for ${res.Errors.length} keys, e.g. ${first?.Key}: ${first?.Code}`,
      );
    }
  }
}

export async function getDownloadUrl(
  key: string,
  options?: { expiresIn?: number; provider?: StorageProvider },
): Promise<string> {
  const provider = options?.provider ?? activeStorageProvider();
  const command = new GetObjectCommand({
    Bucket: requireBucket(provider),
    Key: key,
  });

  return getSignedUrl(getProviderClient(provider), command, {
    expiresIn: options?.expiresIn ?? 3600, // 1 hour by default
  });
}
