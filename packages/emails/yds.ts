import { env } from "./env";
import { signRequest } from "./sigv4";

/**
 * Чтение потока Yandex Data Streams через Kinesis-совместимый API. Подпись
 * AWS SigV4 статическим ключом сервисного аккаунта (сервис kinesis, регион
 * ru-central1), как у Postbox. ListShards YDS не поддерживает — шарды берём
 * из DescribeStream.
 */

const REGION = "ru-central1";
const SERVICE = "kinesis";
const TIMEOUT_MS = 15_000;

export interface YdsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface YdsRecord {
  /** Содержимое записи, уже из base64. */
  data: string;
  sequenceNumber: string;
}

/** Ответ YDS с ошибкой: статус нужен, чтобы отличить неверный запрос от сбоя. */
export class YdsError extends Error {
  constructor(
    readonly action: string,
    readonly status: number,
    details: string,
  ) {
    super(`Data Streams ${action}: HTTP ${status} ${details}`.trim());
  }
}

async function call<T>(
  credentials: YdsCredentials,
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const url = new URL("/", env.YDS_ENDPOINT);
  const body = JSON.stringify(payload);
  // Host подставит сам fetch; в подписи он учтён внутри signRequest
  const { host: _host, ...headers } = signRequest({
    method: "POST",
    url,
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `Kinesis_20131202.${action}`,
    },
    body,
    ...credentials,
    region: REGION,
    service: SERVICE,
  });
  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const details = (await res.text().catch(() => "")).slice(0, 500);
    throw new YdsError(action, res.status, details);
  }
  return (await res.json()) as T;
}

/** Все шарды потока. */
export async function listShards(
  credentials: YdsCredentials,
  stream: string,
): Promise<string[]> {
  const shards: string[] = [];
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const { StreamDescription } = await call<{
      StreamDescription: {
        Shards: { ShardId: string }[];
        HasMoreShards?: boolean;
      };
    }>(credentials, "DescribeStream", {
      StreamName: stream,
      ...(after ? { ExclusiveStartShardId: after } : {}),
    });
    shards.push(...StreamDescription.Shards.map((shard) => shard.ShardId));
    after = shards.at(-1);
    if (!StreamDescription.HasMoreShards || !after) break;
  }
  return shards;
}

/**
 * Итератор шарда: сразу после прочитанной записи, а без неё — с самой
 * старой, что ещё хранит поток.
 */
export async function shardIterator(
  credentials: YdsCredentials,
  stream: string,
  shardId: string,
  afterSequenceNumber: string | null,
): Promise<string> {
  const { ShardIterator } = await call<{ ShardIterator: string }>(
    credentials,
    "GetShardIterator",
    {
      StreamName: stream,
      ShardId: shardId,
      ...(afterSequenceNumber
        ? {
            ShardIteratorType: "AFTER_SEQUENCE_NUMBER",
            StartingSequenceNumber: afterSequenceNumber,
          }
        : { ShardIteratorType: "TRIM_HORIZON" }),
    },
  );
  return ShardIterator;
}

/** Очередная пачка записей и итератор на следующую. */
export async function getRecords(
  credentials: YdsCredentials,
  iterator: string,
  limit: number,
): Promise<{
  records: YdsRecord[];
  next: string | null;
  behindMs: number;
}> {
  const reply = await call<{
    Records?: { Data: string; SequenceNumber: string }[];
    NextShardIterator?: string | null;
    MillisBehindLatest?: number;
  }>(credentials, "GetRecords", { ShardIterator: iterator, Limit: limit });
  return {
    records: (reply.Records ?? []).map((record) => ({
      data: Buffer.from(record.Data, "base64").toString("utf8"),
      sequenceNumber: record.SequenceNumber,
    })),
    next: reply.NextShardIterator ?? null,
    behindMs: reply.MillisBehindLatest ?? 0,
  };
}
