CREATE TABLE "business_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"spent_on" date NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_expenses_amount_positive" CHECK ("business_expenses"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "finance_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"acquiring_rate" integer DEFAULT 350 NOT NULL,
	"tax_rate" integer DEFAULT 400 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_costs" (
	"id" text PRIMARY KEY NOT NULL,
	"product_order_id" text,
	"sale_id" text,
	"category" text NOT NULL,
	"spent_on" date NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_costs_one_order" CHECK (num_nonnulls("order_costs"."product_order_id", "order_costs"."sale_id") = 1),
	CONSTRAINT "order_costs_amount_not_negative" CHECK ("order_costs"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "order_costs" ADD CONSTRAINT "order_costs_product_order_id_product_orders_id_fk" FOREIGN KEY ("product_order_id") REFERENCES "public"."product_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_costs" ADD CONSTRAINT "order_costs_sale_id_crm_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."crm_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_expenses_spent_on_idx" ON "business_expenses" USING btree ("spent_on");--> statement-breakpoint
CREATE INDEX "order_costs_product_order_idx" ON "order_costs" USING btree ("product_order_id");--> statement-breakpoint
CREATE INDEX "order_costs_sale_idx" ON "order_costs" USING btree ("sale_id");