CREATE TABLE "contact_clicks" (
	"id" text PRIMARY KEY NOT NULL,
	"browser_id" text,
	"user_id" text,
	"channel" text NOT NULL,
	"source" text,
	"page" text,
	"entry" jsonb,
	"attribution" jsonb,
	"ip" text,
	"visitor" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_clicks" ADD CONSTRAINT "contact_clicks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_clicks_created_idx" ON "contact_clicks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contact_clicks_browser_idx" ON "contact_clicks" USING btree ("browser_id");--> statement-breakpoint
CREATE INDEX "contact_clicks_user_id_idx" ON "contact_clicks" USING btree ("user_id");