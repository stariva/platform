import { lookup } from "node:dns";
import { BlockList, isIP } from "node:net";
import { Agent, fetch as publicFetch } from "undici";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(address, prefix);

// Resolve in the connector so the address checked is the address dialed.
const dispatcher = new Agent({
  connect: {
    family: 4,
    autoSelectFamily: false,
    lookup(host, _options, callback) {
      lookup(host, { family: 4 }, (error, address, family) => {
        callback(
          error ??
            (blocked.check(address) ? new Error("blocked_destination") : null),
          address,
          family,
        );
      });
    },
  },
});

const imageCdn =
  /^(?:cdn[123]\.ozon(?:e)?\.ru|(?:ir|s3)\.ozone\.ru|cdn\.stariva\.ru|(?:[\w-]+\.)?storage\.yandexcloud\.net)$/;

export type ScanFetch = (
  url: string,
  init: {
    method: string;
    signal: AbortSignal;
    redirect: "manual";
    headers: Record<string, string>;
  },
) => Promise<Pick<Response, "status" | "ok" | "headers" | "url" | "body">>;
export const scanFetch: ScanFetch = (url, init) =>
  publicFetch(url, { ...init, dispatcher });

export function checkedUrl(raw: string, origin: string, allowImages = false) {
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
    (url.origin !== new URL(origin).origin &&
      !(
        allowImages &&
        url.protocol === "https:" &&
        !url.port &&
        imageCdn.test(url.hostname)
      ))
  )
    throw new Error("blocked_destination");
  return url.href;
}

export async function follow(
  url: string,
  origin: string,
  fetchImpl: ScanFetch,
  init: Parameters<ScanFetch>[1],
  allowImages = false,
) {
  for (let redirects = 0; ; redirects++) {
    const res = await fetchImpl(checkedUrl(url, origin, allowImages), init);
    if (![301, 302, 303, 307, 308].includes(res.status)) return res;
    await res.body?.cancel();
    const location = res.headers.get("location");
    if (!location || redirects >= 10) throw new Error("invalid_redirect");
    url = new URL(location, url).href;
  }
}

export async function boundedText(
  response: Pick<Response, "body">,
  limit: number,
) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  let size = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("body_too_large");
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
