CREATE TABLE "npd_income_requests" (
	"payment_id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"receipt_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "npd_income_requests" ADD CONSTRAINT "npd_income_requests_receipt_id_order_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."order_receipts"("id") ON DELETE set null ON UPDATE no action;