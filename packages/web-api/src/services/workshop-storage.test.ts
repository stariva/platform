import { beforeEach, expect, mock, test } from "bun:test";

const config = await import("@stariva/config");
const storage = await import("@stariva/storage");
const database = await import("@stariva/db");
let rows: { slug: string; updatedAt: Date; lessons: []; materialFiles: [] }[] =
  [];
const warn = mock((..._args: unknown[]) => {});
const info = mock((..._args: unknown[]) => {});
const deleteObjects = mock(async (..._args: unknown[]) => {});
const orphan = {
  key: "workshops/orphan.mp4",
  size: 100,
  lastModified: new Date(0),
};
mock.module("@stariva/config", () => ({
  ...config,
  logger: { ...config.logger, warn, info },
}));
mock.module("@stariva/storage", () => ({
  ...storage,
  activeStorageProvider: () => "yandex",
  isProviderConfigured: () => true,
  listObjects: async (_prefix: string, provider?: string) =>
    provider === "vkcloud" ? [orphan] : [],
  deleteObjects,
}));
let selects = 0;
mock.module("@stariva/db", () => ({
  ...database,
  db: {
    select: () => ({ from: async () => (++selects === 1 ? rows : []) }),
  },
}));
const { sweepWorkshopStorage } = await import("./workshop-storage");
beforeEach(() => {
  selects = 0;
  rows = [];
  warn.mockClear();
  info.mockClear();
  deleteObjects.mockClear();
});
test("keeps mirror objects and warns when the workshop query is empty", async () => {
  await sweepWorkshopStorage();
  expect(deleteObjects.mock.calls).toEqual([[[]]]);
  expect(warn).toHaveBeenCalledWith(
    "workshop.storage.sweep.mirror_no_workshops",
    { objects: 1 },
  );
});
test("deletes mirror orphans and logs normally when workshops exist", async () => {
  rows = [
    { slug: "course", updatedAt: new Date(0), lessons: [], materialFiles: [] },
  ];
  await sweepWorkshopStorage();
  expect(deleteObjects).toHaveBeenCalledWith([orphan.key], "vkcloud");
  expect(info).toHaveBeenCalledWith("workshop.storage.sweep.mirror", {
    deleted: 1,
    bytes: 100,
  });
  expect(warn).not.toHaveBeenCalled();
});
