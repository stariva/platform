CREATE TABLE "access_code_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"ip" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_access_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"workshop_slug" text NOT NULL,
	"channel" text NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"created_at" timestamp NOT NULL,
	"redeemed_at" timestamp,
	"order_id" text,
	CONSTRAINT "workshop_access_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "workshop_access_codes" ADD CONSTRAINT "workshop_access_codes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_code_attempts_ip_idx" ON "access_code_attempts" USING btree ("ip","created_at");--> statement-breakpoint
CREATE INDEX "workshop_access_codes_workshop_idx" ON "workshop_access_codes" USING btree ("workshop_slug");