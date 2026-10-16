import { ProxyAgent, fetch as undiciFetch } from "undici";

const agents = new Map<string, ProxyAgent>();

/**
 * fetch для Telegram: через HTTP-прокси (TELEGRAM_PROXY_URL вида
 * http://логин:пароль@хост:порт), если он задан, иначе обычный fetch.
 * Остальной трафик (почта, платежи) идёт напрямую.
 */
export function telegramFetch(proxyUrl?: string): typeof fetch {
  if (!proxyUrl) return fetch;
  let agent = agents.get(proxyUrl);
  if (!agent) {
    agent = new ProxyAgent(proxyUrl);
    agents.set(proxyUrl, agent);
  }
  const dispatcher = agent;
  return ((input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    undiciFetch(input as never, { ...init, dispatcher } as never)) as never;
}
