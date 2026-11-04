import { afterEach, expect, mock, test } from "bun:test";

mock.module("./env", () => ({
  env: { YDS_ENDPOINT: "https://yds.example.test" },
}));
const { getRecords, listShards, shardIterator, YdsError } = await import(
  "./yds"
);

const credentials = { accessKeyId: "key-id", secretAccessKey: "secret" };
const stream = "/ru-central1/folder/db/postbox";
const realFetch = globalThis.fetch;
const calls: { target: string; auth: string; body: unknown }[] = [];

function reply(...bodies: unknown[]) {
  calls.length = 0;
  globalThis.fetch = mock(async (_url: unknown, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>;
    calls.push({
      target: headers["x-amz-target"] ?? "",
      auth: headers.Authorization ?? "",
      body: JSON.parse(String(init?.body)),
    });
    const body = bodies.shift();
    return body instanceof Response ? body : Response.json(body);
  }) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("signs Kinesis calls for the kinesis service in ru-central1", async () => {
  reply({ ShardIterator: "it-1" });
  expect(await shardIterator(credentials, stream, "shard-000000", null)).toBe(
    "it-1",
  );
  expect(calls[0]?.target).toBe("Kinesis_20131202.GetShardIterator");
  expect(calls[0]?.auth).toMatch(
    /^AWS4-HMAC-SHA256 Credential=key-id\/\d{8}\/ru-central1\/kinesis\/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, /,
  );
  expect(calls[0]?.body).toEqual({
    StreamName: stream,
    ShardId: "shard-000000",
    ShardIteratorType: "TRIM_HORIZON",
  });
});

test("continues after the saved record", async () => {
  reply({ ShardIterator: "it-2" });
  await shardIterator(credentials, stream, "shard-000000", "42");
  expect(calls[0]?.body).toMatchObject({
    ShardIteratorType: "AFTER_SEQUENCE_NUMBER",
    StartingSequenceNumber: "42",
  });
});

test("decodes record data from base64", async () => {
  reply({
    Records: [
      {
        Data: Buffer.from('{"eventId":"е1"}').toString("base64"),
        SequenceNumber: "7",
      },
    ],
    NextShardIterator: "it-3",
    MillisBehindLatest: 1200,
  });
  expect(await getRecords(credentials, "it-2", 100)).toEqual({
    records: [{ data: '{"eventId":"е1"}', sequenceNumber: "7" }],
    next: "it-3",
    behindMs: 1200,
  });
  expect(calls[0]?.body).toEqual({ ShardIterator: "it-2", Limit: 100 });
});

test("lists shards page by page", async () => {
  reply(
    {
      StreamDescription: {
        Shards: [{ ShardId: "shard-000000" }],
        HasMoreShards: true,
      },
    },
    {
      StreamDescription: {
        Shards: [{ ShardId: "shard-000001" }],
        HasMoreShards: false,
      },
    },
  );
  expect(await listShards(credentials, stream)).toEqual([
    "shard-000000",
    "shard-000001",
  ]);
  expect(calls[1]?.body).toEqual({
    StreamName: stream,
    ExclusiveStartShardId: "shard-000000",
  });
});

test("reports the HTTP status of a failed call", async () => {
  reply(new Response("bad sequence", { status: 400 }));
  const error = await shardIterator(credentials, stream, "s", "1").catch(
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(YdsError);
  expect(error).toMatchObject({ status: 400, action: "GetShardIterator" });
});
