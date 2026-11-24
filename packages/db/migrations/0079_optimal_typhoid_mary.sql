-- The old Drizzle timestamp column stored UTC wall time.
ALTER TABLE "ozon_pickup_points" ALTER COLUMN "synced_at" SET DATA TYPE timestamp with time zone
USING "synced_at" AT TIME ZONE 'UTC';
