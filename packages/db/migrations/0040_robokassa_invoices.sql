CREATE TABLE "robokassa_invoices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "robokassa_invoices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1001 CACHE 1),
	"product_order_id" text,
	"workshop_order_id" text,
	"amount" integer NOT NULL,
	"payment_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "robokassa_invoices_one_order" CHECK (num_nonnulls("robokassa_invoices"."product_order_id", "robokassa_invoices"."workshop_order_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "robokassa_invoices" ADD CONSTRAINT "robokassa_invoices_product_order_id_product_orders_id_fk" FOREIGN KEY ("product_order_id") REFERENCES "public"."product_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robokassa_invoices" ADD CONSTRAINT "robokassa_invoices_workshop_order_id_orders_id_fk" FOREIGN KEY ("workshop_order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "robokassa_invoices_product_order_idx" ON "robokassa_invoices" USING btree ("product_order_id");--> statement-breakpoint
CREATE INDEX "robokassa_invoices_workshop_order_idx" ON "robokassa_invoices" USING btree ("workshop_order_id");