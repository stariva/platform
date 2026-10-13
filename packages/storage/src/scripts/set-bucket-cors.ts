/**
 * Настраивает CORS закрытого бакета (AWS_S3_BUCKET). Без него браузер не
 * пускает:
 *  - плеер на сайте — hls.js забирает куски видео из бакета через XHR;
 *  - админку — видео и PDF заливаются из браузера прямо в бакет (PUT).
 * Права доступа это не меняет: без подписанной ссылки бакет по-прежнему
 * ничего не отдаёт.
 *
 * Запуск (адреса сайта и админки — аргументами):
 *   bun --env-file=../../.env src/scripts/set-bucket-cors.ts https://stariva.ru https://app.stariva.ru
 * Без аргументов — только показывает текущие правила.
 */
import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const bucket = process.env.AWS_S3_BUCKET;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
if (!bucket || !accessKeyId || !secretAccessKey) {
  throw new Error(
    "Нужны AWS_S3_BUCKET, AWS_ACCESS_KEY_ID и AWS_SECRET_ACCESS_KEY",
  );
}

const origins = process.argv.slice(2);
for (const origin of origins) {
  const url = new URL(origin);
  if (url.origin !== origin) {
    throw new Error(`Нужен адрес без пути и слеша в конце: ${url.origin}`);
  }
}

const client = new S3Client({
  region: process.env.AWS_REGION ?? "ru-central1",
  credentials: { accessKeyId, secretAccessKey },
  endpoint: process.env.AWS_S3_ENDPOINT ?? "https://storage.yandexcloud.net",
  forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE !== "false",
});

async function printRules() {
  try {
    const { CORSRules } = await client.send(
      new GetBucketCorsCommand({ Bucket: bucket }),
    );
    console.log(JSON.stringify(CORSRules, null, 2));
  } catch (error) {
    console.log(`Правил CORS нет (${(error as Error).name})`);
  }
}

if (origins.length > 0) {
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
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
  console.log(`CORS бакета ${bucket} обновлён:`);
}
await printRules();
