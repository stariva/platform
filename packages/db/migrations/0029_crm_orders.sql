CREATE TABLE "crm_sale_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text NOT NULL,
	"paid_on" date NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_sale_payments_amount_positive" CHECK ("crm_sale_payments"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "crm_sales" DROP CONSTRAINT "crm_sales_amount_positive";--> statement-breakpoint
ALTER TABLE "crm_sales" ADD COLUMN "channel" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_sales" ADD COLUMN "status" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_sales" ADD COLUMN "external_number" text;--> statement-breakpoint
ALTER TABLE "crm_sales" ADD COLUMN "due_on" date;--> statement-breakpoint
ALTER TABLE "crm_sales" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "crm_sales" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "crm_sales" ADD COLUMN "fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_sales" ADD COLUMN "status_changed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_sales" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "crm_sales" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_order_requests" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "crm_sale_payments" ADD CONSTRAINT "crm_sale_payments_sale_id_crm_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."crm_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_sale_payments_sale_idx" ON "crm_sale_payments" USING btree ("sale_id");--> statement-breakpoint
ALTER TABLE "crm_sales" ADD CONSTRAINT "crm_sales_amount_not_negative" CHECK ("crm_sales"."amount" >= 0);--> statement-breakpoint
ALTER TABLE "crm_sales" ADD CONSTRAINT "crm_sales_fee_not_negative" CHECK ("crm_sales"."fee" >= 0);--> statement-breakpoint
-- Записанные раньше продажи уже оплачены целиком: выполненный заказ и одна оплата на всю сумму в день продажи
UPDATE "crm_sales" SET "status" = 'done', "closed_at" = ("sold_on" + time '12:00') AT TIME ZONE 'Europe/Moscow', "status_changed_at" = ("sold_on" + time '12:00') AT TIME ZONE 'Europe/Moscow', "updated_at" = "created_at";--> statement-breakpoint
INSERT INTO "crm_sale_payments" ("id", "sale_id", "paid_on", "amount", "created_at") SELECT gen_random_uuid()::text, "id", "sold_on", "amount", "created_at" FROM "crm_sales" WHERE "amount" > 0;
