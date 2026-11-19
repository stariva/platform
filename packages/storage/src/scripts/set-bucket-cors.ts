/**
 * Настраивает CORS закрытых бакетов (AWS_S3_BUCKET, а если задан — и
 * VK_S3_BUCKET). Без него браузер не пускает:
 *  - плеер на сайте — hls.js забирает куски видео из бакета через XHR;
 *  - админку — видео и PDF заливаются из браузера прямо в бакет (PUT).
 * Права доступа это не меняет: без подписанной ссылки бакет по-прежнему
 * ничего не отдаёт.
 *
 * Запуск (адреса сайта и админки — аргументами):
 *   bun --env-file=../../.env src/scripts/set-bucket-cors.ts https://stariva.ru https://app.stariva.ru
 * Без аргументов — только показывает текущие правила.
 *
 * Мобильное приложение открывает бандл как https://localhost (Android) и
 * capacitor://localhost (iOS): без них в списке видео в приложении не
 * загрузится. Правила заменяются целиком, поэтому передавайте все адреса сразу:
 *   bun --env-file=../../.env src/scripts/set-bucket-cors.ts https://stariva.ru https://app.stariva.ru https://localhost capacitor://localhost
 */
import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

interface Bucket {
  name: string;
  client: S3Client;
}

/** Настроенные закрытые бакеты: активный и зеркало, если задано. */
function buckets(): Bucket[] {
  const configured: Bucket[] = [];
  const yandex = {
    name: process.env.AWS_S3_BUCKET ?? "",
    client: new S3Client({
      region: process.env.AWS_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
      endpoint:
        process.env.AWS_S3_ENDPOINT ?? "https://storage.yandexcloud.net",
      forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE !== "false",
    }),
  };
  if (
    yandex.name &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  ) {
    configured.push(yandex);
  }

  const vkcloud = {
    name: process.env.VK_S3_BUCKET ?? "",
    client: new S3Client({
      region: process.env.VK_S3_REGION ?? "ru-msk",
      credentials: {
        accessKeyId: process.env.VK_S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.VK_S3_SECRET_ACCESS_KEY ?? "",
      },
      endpoint:
        process.env.VK_S3_ENDPOINT ?? "https://hb.ru-msk.vkcloud-storage.ru",
      forcePathStyle: process.env.VK_S3_FORCE_PATH_STYLE !== "false",
    }),
  };
  if (
    vkcloud.name &&
    process.env.VK_S3_ACCESS_KEY_ID &&
    process.env.VK_S3_SECRET_ACCESS_KEY
  ) {
    configured.push(vkcloud);
  }

  return configured;
}

const origins = process.argv.slice(2);
for (const origin of origins) {
  const url = new URL(origin);
  // Не url.origin: у capacitor://localhost (приложение на iOS) он «null»
  const normalized = `${url.protocol}//${url.host}`;
  if (normalized !== origin) {
    throw new Error(`Нужен адрес без пути и слеша в конце: ${normalized}`);
  }
}

const list = buckets();
if (list.length === 0) {
  throw new Error(
    "Нужен хотя бы один бакет: AWS_S3_BUCKET или VK_S3_BUCKET с ключами",
  );
}

async function printRules(bucket: Bucket) {
  try {
    const { CORSRules } = await bucket.client.send(
      new GetBucketCorsCommand({ Bucket: bucket.name }),
    );
    console.log(JSON.stringify(CORSRules, null, 2));
  } catch (error) {
    console.log(`Правил CORS нет (${(error as Error).name})`);
  }
}

for (const bucket of list) {
  if (origins.length > 0) {
    await bucket.client.send(
      new PutBucketCorsCommand({
        Bucket: bucket.name,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: origins,
              AllowedMethods: ["GET", "HEAD", "PUT"],
              AllowedHeaders: ["*"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    console.log(`CORS бакета ${bucket.name} обновлён:`);
  } else {
    console.log(`CORS бакета ${bucket.name}:`);
  }
  await printRules(bucket);
}
