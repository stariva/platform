import {
  GetObjectCommand,
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
