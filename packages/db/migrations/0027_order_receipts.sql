CREATE TABLE "order_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"product_order_id" text,
	"workshop_order_id" text,
	"inn" text NOT NULL,
	"number" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"emailed_at" timestamp with time zone,
	"emailed_to" text,
	CONSTRAINT "order_receipts_one_order" CHECK (num_nonnulls("order_receipts"."product_order_id", "order_receipts"."workshop_order_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "order_receipts" ADD CONSTRAINT "order_receipts_product_order_id_product_orders_id_fk" FOREIGN KEY ("product_order_id") REFERENCES "public"."product_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_receipts" ADD CONSTRAINT "order_receipts_workshop_order_id_orders_id_fk" FOREIGN KEY ("workshop_order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_receipts_inn_number_idx" ON "order_receipts" USING btree ("inn","number");--> statement-breakpoint
CREATE INDEX "order_receipts_product_order_idx" ON "order_receipts" USING btree ("product_order_id");--> statement-breakpoint
CREATE INDEX "order_receipts_workshop_order_idx" ON "order_receipts" USING btree ("workshop_order_id");