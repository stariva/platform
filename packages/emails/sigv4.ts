import { createHash, createHmac } from "node:crypto";

interface SignInput {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  now?: Date;
}

const sha256 = (data: string) =>
  createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) =>
  createHmac("sha256", key).update(data).digest();

const encode = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * AWS Signature V4: возвращает заголовки запроса вместе с `x-amz-date` и
 * `Authorization`. Postbox принимает подпись со статическим ключом сервисного
 * аккаунта (регион ru-central1, сервис ses), отдельный SDK для этого не нужен.
 */
export function signRequest(input: SignInput): Record<string, string> {
  const { method, url, body, region, service } = input;
  const amzDate = (input.now ?? new Date())
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    ...input.headers,
    host: url.host,
    "x-amz-date": amzDate,
  };
  const names = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort();
  const byLowerName = new Map(
    Object.entries(headers).map(([name, value]) => [
      name.toLowerCase(),
      value.trim().replace(/\s+/g, " "),
    ]),
  );
  const signedHeaders = names.join(";");

  const query = [...url.searchParams.entries()]
    .map(([key, value]) => [encode(key), encode(value)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const canonicalRequest = [
    method.toUpperCase(),
    url.pathname,
    query,
    ...names.map((name) => `${name}:${byLowerName.get(name)}`),
    "",
    signedHeaders,
    sha256(body),
  ].join("\n");

  const scope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = hmac(
    hmac(
      hmac(hmac(`AWS4${input.secretAccessKey}`, date), region),
      service,
    ),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
