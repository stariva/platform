ALTER TABLE "robokassa_invoices" DROP CONSTRAINT "robokassa_invoices_product_order_id_product_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "robokassa_invoices" DROP CONSTRAINT "robokassa_invoices_workshop_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "robokassa_invoices" ADD CONSTRAINT "robokassa_invoices_product_order_id_product_orders_id_fk" FOREIGN KEY ("product_order_id") REFERENCES "public"."product_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robokassa_invoices" ADD CONSTRAINT "robokassa_invoices_workshop_order_id_orders_id_fk" FOREIGN KEY ("workshop_order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;