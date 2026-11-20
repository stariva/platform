import { beforeEach, expect, mock, test } from "bun:test";
import type { SweepWorkshopStorageDeps } from "./workshop-storage/sweep";
import { sweepWorkshopStorage } from "./workshop-storage/sweep";

const rows: {
  slug: string;
  updatedAt: Date;
  lessons: [];
  materialFiles: [];
}[] = [];
const warn = mock((..._args: unknown[]) => {});
const info = mock((..._args: unknown[]) => {});
const deleteObjects = mock(async (..._args: unknown[]) => {});
const deleteRenditions = mock(async (..._args: unknown[]) => {});
const orphan = {
  key: "workshops/orphan.mp4",
  size: 100,
  lastModified: new Date(0),
};

const deps: SweepWorkshopStorageDeps = {
  listObjects: async (_prefix: string, provider?: string) =>
    provider === "vkcloud" ? [orphan] : [],
  deleteObjects,
  activeStorageProvider: () => "yandex",
  isProviderConfigured: () => true,
  otherStorageProvider: () => "vkcloud",
  getWorkshops: async () => rows,
  getRenditions: async () => [],
  deleteRenditions,
  logger: { warn, info } as unknown as SweepWorkshopStorageDeps["logger"],
};

beforeEach(() => {
  rows.length = 0;
  warn.mockClear();
  info.mockClear();
  deleteObjects.mockClear();
  deleteRenditions.mockClear();
});

test("keeps mirror objects and warns when the workshop query is empty", async () => {
  await sweepWorkshopStorage({}, deps);
  expect(deleteObjects.mock.calls).toEqual([[[]]]);
  expect(warn).toHaveBeenCalledWith(
    "workshop.storage.sweep.mirror_no_workshops",
    { objects: 1 },
  );
});

test("deletes mirror orphans and logs normally when workshops exist", async () => {
  rows.push({
    slug: "course",
    updatedAt: new Date(0),
    lessons: [],
    materialFiles: [],
  });
  await sweepWorkshopStorage({}, deps);
  expect(deleteObjects).toHaveBeenCalledWith([orphan.key], "vkcloud");
  expect(info).toHaveBeenCalledWith("workshop.storage.sweep.mirror", {
    deleted: 1,
    bytes: 100,
  });
  expect(warn).not.toHaveBeenCalled();
});
