CREATE TABLE "video_access_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"workshop_slug" text NOT NULL,
	"lesson_id" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_access_log" ADD CONSTRAINT "video_access_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_access_log_user_created_idx" ON "video_access_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "video_access_log_ip_created_idx" ON "video_access_log" USING btree ("ip","created_at");