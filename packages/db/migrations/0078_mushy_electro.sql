CREATE TABLE "ozon_pickup_points" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"working_hours" jsonb,
	"meta" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"synced_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ozon_pvz_city_idx" ON "ozon_pickup_points" USING btree ("city");--> statement-breakpoint
CREATE INDEX "ozon_pvz_lat_lon_idx" ON "ozon_pickup_points" USING btree ("lat","lon");--> statement-breakpoint
CREATE INDEX "ozon_pvz_active_idx" ON "ozon_pickup_points" USING btree ("is_active");