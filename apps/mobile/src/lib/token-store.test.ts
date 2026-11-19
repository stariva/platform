import { expect, test } from "bun:test";
import { createTokenStore, type KeyValueStorage } from "./token-store";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const calls = { get: 0, set: 0, remove: 0 };
  const storage: KeyValueStorage = {
    async get(key) {
      calls.get++;
      return data.get(key) ?? null;
    },
    async set(key, value) {
      calls.set++;
      data.set(key, value);
    },
    async remove(key) {
      calls.remove++;
      data.delete(key);
    },
  };
  return { storage, data, calls };
}

test("читает сохранённый токен и запоминает его", async () => {
  const { storage, calls } = memoryStorage({ "stariva.session-token": "a.b" });
  const store = createTokenStore(storage);
  expect(await store.get()).toBe("a.b");
  expect(await store.get()).toBe("a.b");
  expect(calls.get).toBe(1);
});

test("set пишет в хранилище, clear стирает", async () => {
  const { storage, data } = memoryStorage();
  const store = createTokenStore(storage);
  expect(await store.get()).toBeNull();
  await store.set("x.y");
  expect(await store.get()).toBe("x.y");
  expect(data.get("stariva.session-token")).toBe("x.y");
  await store.clear();
  expect(await store.get()).toBeNull();
  expect(data.has("stariva.session-token")).toBe(false);
});

test("сбой хранилища при чтении — как будто токена нет", async () => {
  const store = createTokenStore({
    get: async () => {
      throw new Error("denied");
    },
    set: async () => {},
    remove: async () => {},
  });
  expect(await store.get()).toBeNull();
});

test("сбой хранилища при выходе не оставляет токен в памяти", async () => {
  const store = createTokenStore({
    get: async () => "a.b",
    set: async () => {},
    remove: async () => {
      throw new Error("denied");
    },
  });
  expect(await store.get()).toBe("a.b");
  await store.clear();
  expect(await store.get()).toBeNull();
});

test("токен, записанный во время чтения, не затирается старым значением", async () => {
  let release: (value: string | null) => void = () => {};
  const store = createTokenStore({
    get: () => new Promise((resolve) => (release = resolve)),
    set: async () => {},
    remove: async () => {},
  });
  const reading = store.get();
  await store.set("new.token");
  release("old.token");
  expect(await reading).toBe("new.token");
  expect(await store.get()).toBe("new.token");
});
