ALTER TABLE "reviews" ADD COLUMN "workshop_slug" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "publish_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_user_workshop_uq" ON "reviews" USING btree ("user_id","workshop_slug");