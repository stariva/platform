CREATE TABLE "direct_search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"campaign_id" bigint,
	"campaign_name" text,
	"ad_group_id" bigint,
	"ad_group_name" text,
	"ad_id" text,
	"query" text,
	"criterion_id" text,
	"criterion" text,
	"criterion_type" text,
	"matched_keyword" text,
	"match_type" text,
	"targeting_category" text,
	"income_grade" text,
	"placement" text,
	"impressions" integer NOT NULL,
	"clicks" integer NOT NULL,
	"cost" numeric(14, 2) NOT NULL,
	"bounces" integer,
	"conversions" jsonb,
	"revenue" jsonb,
	"data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "direct_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"campaign_id" bigint,
	"campaign_name" text,
	"campaign_type" text,
	"ad_group_id" bigint,
	"ad_group_name" text,
	"ad_id" text,
	"ad_format" text,
	"criterion_id" text,
	"criterion" text,
	"criterion_type" text,
	"match_type" text,
	"targeting_category" text,
	"age" text,
	"gender" text,
	"income_grade" text,
	"device" text,
	"mobile_platform" text,
	"carrier_type" text,
	"location_id" bigint,
	"location_name" text,
	"targeting_location_id" bigint,
	"targeting_location_name" text,
	"ad_network_type" text,
	"placement" text,
	"external_network_name" text,
	"slot" text,
	"impressions" integer NOT NULL,
	"clicks" integer NOT NULL,
	"cost" numeric(14, 2) NOT NULL,
	"bounces" integer,
	"sessions" integer,
	"conversions" jsonb,
	"revenue" jsonb,
	"data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrika_goals" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrika_hits" (
	"watch_id" text PRIMARY KEY NOT NULL,
	"visit_id" text,
	"client_id" text,
	"at" timestamp with time zone NOT NULL,
	"url" text,
	"title" text,
	"referer" text,
	"is_page_view" boolean,
	"goal_ids" bigint[],
	"data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrika_visits" (
	"visit_id" text PRIMARY KEY NOT NULL,
	"client_id" text,
	"started_at" timestamp with time zone NOT NULL,
	"is_new_user" boolean,
	"start_url" text,
	"end_url" text,
	"page_views" integer,
	"duration" integer,
	"bounce" boolean,
	"traffic_source" text,
	"first_traffic_source" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"direct_campaign_id" bigint,
	"direct_ad_group_id" bigint,
	"direct_ad_id" text,
	"direct_phrase" text,
	"direct_condition_type" text,
	"direct_platform_type" text,
	"direct_platform" text,
	"country" text,
	"city" text,
	"device_category" text,
	"operating_system" text,
	"browser" text,
	"goal_ids" bigint[],
	"purchase_ids" text[],
	"data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "direct_search_queries_date_idx" ON "direct_search_queries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "direct_stats_date_idx" ON "direct_stats" USING btree ("date");--> statement-breakpoint
CREATE INDEX "direct_stats_campaign_idx" ON "direct_stats" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "metrika_hits_client_idx" ON "metrika_hits" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "metrika_hits_visit_idx" ON "metrika_hits" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "metrika_hits_at_idx" ON "metrika_hits" USING btree ("at");--> statement-breakpoint
CREATE INDEX "metrika_visits_client_idx" ON "metrika_visits" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "metrika_visits_started_idx" ON "metrika_visits" USING btree ("started_at");--> statement-breakpoint
CREATE VIEW "public"."workshop_buyers" AS (
  select
    o.id as order_id,
    o.user_id,
    o.workshop_slug,
    o.amount,
    o.created_at,
    o.paid_at,
    o.visitor->>'ymClientId' as client_id,
    o.visitor->>'city' as city,
    o.visitor->>'region' as region,
    o.visitor->>'device' as device,
    o.visitor->>'deviceModel' as device_model,
    o.visitor->>'os' as os,
    o.visitor->>'browser' as browser,
    o.attribution->'first'->>'utm_source' as utm_source_first,
    o.attribution->'first'->>'utm_campaign' as utm_campaign_first,
    o.attribution->'last'->>'utm_source' as utm_source_last,
    o.attribution->'last'->>'utm_campaign' as utm_campaign_last,
    s.visits as visits_before,
    s.page_views as page_views_before,
    s.seconds as seconds_on_site_before,
    s.first_at as first_visit_at,
    round(extract(epoch from (coalesce(o.paid_at, o.created_at) at time zone 'UTC' - s.first_at)) / 86400, 1) as days_to_purchase,
    fv.traffic_source as first_visit_source,
    fv.start_url as first_visit_start_url,
    lv.traffic_source as last_visit_source,
    lv.start_url as last_visit_start_url,
    lv.direct_campaign_id,
    lv.direct_ad_group_id,
    lv.direct_ad_id,
    lv.direct_phrase,
    lv.direct_condition_type,
    lv.direct_platform_type,
    lv.direct_platform,
    lv.city as metrika_city,
    lv.device_category as metrika_device
  from orders o
  left join lateral (
    select
      count(*)::int as visits,
      sum(v.page_views)::int as page_views,
      sum(v.duration)::int as seconds,
      min(v.started_at) as first_at
    from metrika_visits v
    where v.client_id = o.visitor->>'ymClientId'
      and v.started_at <= coalesce(o.paid_at, o.created_at) at time zone 'UTC'
  ) s on true
  left join lateral (
    select v.traffic_source, v.start_url
    from metrika_visits v
    where v.client_id = o.visitor->>'ymClientId'
      and v.started_at <= coalesce(o.paid_at, o.created_at) at time zone 'UTC'
    order by v.started_at
    limit 1
  ) fv on true
  left join lateral (
    select v.*
    from metrika_visits v
    where v.client_id = o.visitor->>'ymClientId'
      and v.started_at <= coalesce(o.paid_at, o.created_at) at time zone 'UTC'
    order by v.started_at desc
    limit 1
  ) lv on true
  where o.status = 'paid'
);