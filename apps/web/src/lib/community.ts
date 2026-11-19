/**
 * Stariva Community — группы в мессенджерах для тех, кто любит макраме.
 * Единственный источник ссылок на сообщество. Пустая ссылка — группа ещё
 * не создана: приглашения на сайте её не показывают, а без обеих ссылок
 * не показываются вовсе.
 */
export const COMMUNITY: { telegramUrl: string; maxUrl: string } = {
  telegramUrl: "https://t.me/stariva01",
  maxUrl: "",
};

export type CommunityChannel = "telegram" | "max";

export const COMMUNITY_LINKS: { channel: CommunityChannel; href: string }[] = [
  { channel: "telegram" as const, href: COMMUNITY.telegramUrl },
  { channel: "max" as const, href: COMMUNITY.maxUrl },
].filter((link) => link.href !== "");

const STORAGE_KEY = "stariva:community-invite";
const STATE_CHANGED_EVENT = "stariva:community-invite-change";
/** Сколько не показывать карточку после «Не сейчас». */
const SNOOZE_MS = 60 * 24 * 60 * 60 * 1000;

type InviteState = { joined: true } | { snoozedAt: number };

function readState(): InviteState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const state: unknown = raw ? JSON.parse(raw) : null;
    if (!state || typeof state !== "object" || Array.isArray(state))
      return null;
    if ("joined" in state) {
      return state.joined === true ? { joined: true } : null;
    }
    if (
      "snoozedAt" in state &&
      typeof state.snoozedAt === "number" &&
      Number.isFinite(state.snoozedAt)
    ) {
      return { snoozedAt: state.snoozedAt };
    }
    return null;
  } catch {
    return null;
  }
}

function writeState(state: InviteState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // storage не срабатывает во вкладке, которая записала значение.
    window.dispatchEvent(new Event(STATE_CHANGED_EVENT));
  } catch {
    /* storage blocked — карточка просто покажется снова */
  }
}

export function subscribeCommunityInvite(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener(STATE_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(STATE_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Показывать ли карточку-приглашение: не тем, кто уже перешёл в группу,
 * и не раньше чем через 60 дней после «Не сейчас». Ссылки в подвале
 * видны всегда.
 */
export function shouldShowCommunityInvite(now = Date.now()): boolean {
  if (COMMUNITY_LINKS.length === 0) return false;
  const state = readState();
  if (!state) return true;
  if ("joined" in state) return false;
  return now - state.snoozedAt > SNOOZE_MS;
}

export function markCommunityJoined() {
  writeState({ joined: true });
}

export function snoozeCommunityInvite(now = Date.now()) {
  const state = readState();
  if (state && "joined" in state) return;
  writeState({ snoozedAt: now });
}
