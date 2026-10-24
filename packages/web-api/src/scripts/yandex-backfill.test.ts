import { expect, test } from "bun:test";

function run(...dates: string[]) {
  const env = {
    ...process.env,
    YANDEX_METRIKA_TOKEN: "",
    YANDEX_DIRECT_TOKEN: "",
  };
  delete env.POSTGRES_URL;
  return Bun.spawnSync(
    [
      process.execPath,
      "--no-env-file",
      new URL("./yandex-backfill.ts", import.meta.url).pathname,
      ...dates,
    ],
    { env },
  );
}

test.each([
  "2026-02-29",
  "2026-04-31",
  "2026-13-01",
  "2026-00-01",
  "2026-01-00",
  "2026-01-32",
  "2026-1-01",
  "invalid",
])("rejects invalid calendar date %s in either argument", (date) => {
  for (const dates of [
    [date, "2027-01-01"],
    ["2020-01-01", date],
  ]) {
    const result = run(...dates);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("Использование:");
    expect(result.stdout.toString()).toBe("");
  }
});

test("requires a start date and an ordered range", () => {
  expect(run().exitCode).toBe(1);
  expect(run("2026-10-24", "2026-10-23").exitCode).toBe(1);
});

test.each([
  ["2024-02-29", "2024-02-29"],
  ["2000-02-29", "2026-10-23"],
  ["2026-01-01"],
])("accepts valid dates %j", (...dates) => {
  const result = run(...dates);
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("Директ пропускаю");
});
