ALTER TABLE "workshops" ADD COLUMN "support_chat_url" text;--> statement-breakpoint
UPDATE "workshops" SET "support_chat_url" = 'https://t.me/+nzXZQ0mgbok1ZjZi' WHERE "slug" IN ('elka-makrame', 'elka-makrame-bolshaya');
