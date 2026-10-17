CREATE TABLE "login_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"method" text,
	"failure_reason" text,
	"session_id" text,
	"ip_address" text,
	"user_agent" text,
	"visitor" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_events_user_created_idx" ON "login_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "login_events_user_ip_idx" ON "login_events" USING btree ("user_id","ip_address");--> statement-breakpoint
-- Действующие сессии уже хранят IP и устройство входа: переносим их в журнал, чтобы у существующих пользователей он не начинался с пустоты
INSERT INTO "login_events" ("id", "user_id", "type", "session_id", "ip_address", "user_agent", "created_at") SELECT gen_random_uuid()::text, "user_id", 'sign_in', "id", "ip_address", "user_agent", "created_at" FROM "sessions";
