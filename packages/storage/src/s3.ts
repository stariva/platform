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

const BUCKET_NAME = env.AWS_S3_BUCKET;

/** Whether S3 credentials and a bucket are configured for this environment. */
export function isStorageConfigured(): boolean {
  return Boolean(
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET,
  );
}

let cachedClient: S3Client | undefined;

/**
 * Lazily creates the S3 client so importing this module never throws when
 * credentials aren't configured yet (e.g. local dev without storage set up).
 * The client is only constructed the first time a function here is called.
 */
function getClient(): S3Client {
  if (cachedClient) return cachedClient;

  const accessKeyId = env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS credentials (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY) are required",
    );
  }

  const s3Endpoint = env.AWS_S3_ENDPOINT;
  const s3ForcePathStyle = env.AWS_S3_FORCE_PATH_STYLE !== "false";

  cachedClient = new S3Client({
    region: env.AWS_REGION,
    credentials: { accessKeyId, secretAccessKey },
    ...(s3Endpoint
      ? {
          endpoint: s3Endpoint,
          forcePathStyle: s3ForcePathStyle, // MinIO/Yandex-friendly by default when endpoint provided
        }
      : {}),
  });
  return cachedClient;
}

export async function createPresignedUrl(key: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: "application/octet-stream",
  });

  return getSignedUrl(getClient(), command, { expiresIn: 3600 }); // 1 hour
}

/**
 * Ссылка для загрузки файла напрямую из браузера в закрытый бакет (PUT).
 * Видео слишком большие, чтобы гнать их через сервер приложения. Content-Type
 * подписывается — браузер обязан отправить тот же.
 */
export async function createUploadUrl(
  key: string,
  contentType: string,
  options?: { expiresIn?: number; contentLength?: number },
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: options?.contentLength,
  });
  return getSignedUrl(getClient(), command, {
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
): Promise<{ key: string; bucket: string; etag?: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType ?? "application/octet-stream",
  });
  try {
    const res = await getClient().send(command);
    return { key, bucket: BUCKET_NAME, etag: res.ETag };
  } catch (err) {
    const e = err as Error;
    console.error("S3 upload failed", {
      bucket: BUCKET_NAME,
      key,
      error: e?.message ?? String(err),
      stack: e?.stack,
    });
    throw new Error(
      `Failed to upload to S3 bucket '${BUCKET_NAME}' key '${key}': ${e?.message ?? String(err)}`,
    );
  }
}

// ─── Публичный бакет (фото каталога) ─────────────────────────────────────────

/** Задан публичный бакет и ключи — можно выкладывать фото каталога. */
export function isPublicStorageConfigured(): boolean {
  return Boolean(isStorageConfigured() && env.AWS_S3_PUBLIC_BUCKET);
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

  await getClient().send(
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

/** Текст небольшого файла из закрытого бакета (например, плейлиста HLS). */
export async function getObjectText(key: string): Promise<string> {
  const res = await getClient().send(
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
  );
  if (!res.Body) throw new Error(`empty object: ${key}`);
  return res.Body.transformToString("utf-8");
}

/** Содержимое файла из закрытого бакета целиком (например, PDF во вложение письма). */
export async function getObjectBytes(key: string): Promise<Buffer> {
  const res = await getClient().send(
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
  );
  if (!res.Body) throw new Error(`empty object: ${key}`);
  return Buffer.from(await res.Body.transformToByteArray());
}

/** Файл из закрытого бакета потоком — отдать через сайт, не держа в памяти. */
export async function getObjectStream(key: string): Promise<{
  body: ReadableStream;
  contentLength?: number;
}> {
  const res = await getClient().send(
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
  );
  if (!res.Body) throw new Error(`empty object: ${key}`);
  return {
    body: res.Body.transformToWebStream(),
    contentLength: res.ContentLength,
  };
}

/** Есть ли файл в закрытом бакете. */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await getClient().send(
      new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
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
export async function objectLastModified(key: string): Promise<Date | null> {
  try {
    const res = await getClient().send(
      new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
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

/** Все файлы закрытого бакета под префиксом (постранично, по 1000). */
export async function listObjects(prefix: string): Promise<StoredObject[]> {
  const objects: StoredObject[] = [];
  let token: string | undefined;
  do {
    const res = await getClient().send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
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
export async function deleteObjects(keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000) {
    const res = await getClient().send(
      new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
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
  options?: { expiresIn?: number },
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(getClient(), command, {
    expiresIn: options?.expiresIn ?? 3600, // 1 hour by default
  });
}
