ALTER TABLE "workshop_order_notifications" ALTER COLUMN "sent_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "workshop_order_notifications" ALTER COLUMN "sent_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_order_notifications" ADD COLUMN "lease_until" timestamp with time zone;