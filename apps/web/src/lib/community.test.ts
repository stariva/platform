import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  COMMUNITY_LINKS,
  markCommunityJoined,
  shouldShowCommunityInvite,
  snoozeCommunityInvite,
  subscribeCommunityInvite,
} from "./community";

const STORAGE_KEY = "stariva:community-invite";
const NOW = Date.UTC(2026, 9, 27);
const SNOOZE_MS = 60 * 24 * 60 * 60 * 1000;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalLinks = [...COMMUNITY_LINKS];
let stored: string | null;

beforeEach(() => {
  stored = null;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      localStorage: {
        getItem: () => stored,
        setItem: (_key: string, value: string) => {
          stored = value;
        },
      },
    }),
  });
  COMMUNITY_LINKS.splice(0, COMMUNITY_LINKS.length, {
    channel: "telegram",
    href: "https://example.com/community",
  });
});

afterEach(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
  COMMUNITY_LINKS.splice(0, COMMUNITY_LINKS.length, ...originalLinks);
});

test("no configured community links means no invitation", () => {
  COMMUNITY_LINKS.length = 0;
  assert.equal(shouldShowCommunityInvite(NOW), false);
});

test("missing, malformed, or incomplete stored state allows the invitation", () => {
  for (const raw of [
    null,
    "not json",
    "null",
    "true",
    "42",
    '"joined"',
    "[]",
    '[{"joined":true}]',
    "{}",
    '{"joined":false}',
    '{"joined":"true"}',
    '{"snoozedAt":null}',
    '{"snoozedAt":"0"}',
    '{"snoozedAt":1e400}',
    '{"joined":false,"snoozedAt":0}',
  ]) {
    stored = raw;
    assert.equal(shouldShowCommunityInvite(NOW), true, String(raw));
  }
});

test("joined state keeps the invitation hidden", () => {
  stored = '{"joined":true}';
  assert.equal(shouldShowCommunityInvite(NOW), false);
  assert.equal(shouldShowCommunityInvite(NOW + SNOOZE_MS * 10), false);
});

test("snoozing hides the invitation for 60 days", () => {
  snoozeCommunityInvite(NOW);
  assert.equal(shouldShowCommunityInvite(NOW), false);
  assert.equal(shouldShowCommunityInvite(NOW + SNOOZE_MS), false);
  assert.equal(shouldShowCommunityInvite(NOW + SNOOZE_MS + 1), true);
});

test("snoozing after joining preserves the permanent dismissal", () => {
  markCommunityJoined();
  snoozeCommunityInvite(NOW);
  assert.deepEqual(JSON.parse(stored ?? "null"), { joined: true });
  assert.equal(shouldShowCommunityInvite(NOW + SNOOZE_MS + 1), false);
});

test("joining replaces a temporary snooze with a permanent dismissal", () => {
  snoozeCommunityInvite(NOW);
  markCommunityJoined();
  assert.deepEqual(JSON.parse(stored ?? "null"), { joined: true });
});

test("same-tab updates notify mounted subscribers and unsubscribe cleans up", () => {
  const visibility: boolean[] = [];
  const unsubscribe = subscribeCommunityInvite(() => {
    visibility.push(shouldShowCommunityInvite(NOW));
  });
  snoozeCommunityInvite(NOW);
  markCommunityJoined();
  assert.deepEqual(visibility, [false, false]);
  unsubscribe();
  markCommunityJoined();
  window.dispatchEvent(
    Object.assign(new Event("storage"), { key: STORAGE_KEY }),
  );
  assert.deepEqual(visibility, [false, false]);
});

test("other-tab storage updates and clearing storage refresh subscribers", () => {
  const visibility: boolean[] = [];
  const unsubscribe = subscribeCommunityInvite(() => {
    visibility.push(shouldShowCommunityInvite(NOW));
  });
  stored = '{"joined":true}';
  window.dispatchEvent(Object.assign(new Event("storage"), { key: "other" }));
  assert.deepEqual(visibility, []);
  window.dispatchEvent(
    Object.assign(new Event("storage"), { key: STORAGE_KEY }),
  );
  stored = null;
  window.dispatchEvent(Object.assign(new Event("storage"), { key: null }));
  assert.deepEqual(visibility, [false, true]);
  unsubscribe();
});

test("blocked storage does not throw or permanently hide the invitation", () => {
  window.localStorage.getItem = () => {
    throw new Error("storage blocked");
  };
  window.localStorage.setItem = () => {
    throw new Error("storage blocked");
  };
  assert.equal(shouldShowCommunityInvite(NOW), true);
  assert.doesNotThrow(markCommunityJoined);
  assert.doesNotThrow(() => snoozeCommunityInvite(NOW));
});
