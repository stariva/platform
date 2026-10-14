CREATE TABLE "ad_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"channel" text DEFAULT 'other' NOT NULL,
	"utm_source" text,
	"utm_campaign" text,
	"notes" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ad_campaigns_utm_campaign_needs_source" CHECK ("ad_campaigns"."utm_campaign" IS NULL OR "ad_campaigns"."utm_source" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "ad_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"spent_on" date NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ad_expenses_amount_positive" CHECK ("ad_expenses"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "crm_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"source_manual" boolean DEFAULT false NOT NULL,
	"campaign_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_sales" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"sold_on" date NOT NULL,
	"amount" integer NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_sales_amount_positive" CHECK ("crm_sales"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "ad_expenses" ADD CONSTRAINT "ad_expenses_campaign_id_ad_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_campaign_id_ad_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sales" ADD CONSTRAINT "crm_sales_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ad_campaigns_utm_idx" ON "ad_campaigns" USING btree ("utm_source",coalesce("utm_campaign", '')) WHERE "ad_campaigns"."utm_source" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ad_expenses_campaign_idx" ON "ad_expenses" USING btree ("campaign_id","spent_on");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_clients_phone_idx" ON "crm_clients" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_clients_email_idx" ON "crm_clients" USING btree ("email");--> statement-breakpoint
CREATE INDEX "crm_sales_client_idx" ON "crm_sales" USING btree ("client_id");