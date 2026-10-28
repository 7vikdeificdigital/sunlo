CREATE TABLE IF NOT EXISTS "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_vendor_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"rate_per_min" integer DEFAULT 0 NOT NULL,
	"commission_pct" integer NOT NULL,
	"max_listeners" integer DEFAULT 100 NOT NULL,
	"status" text DEFAULT 'LIVE' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"peak_listeners" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rooms_type_chk" CHECK ("type" IN ('AUDIO','VIDEO')),
	CONSTRAINT "rooms_rate_chk" CHECK ("rate_per_min" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rooms_one_live_per_host_uq" ON "rooms" ("host_vendor_id") WHERE status = 'LIVE';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rooms_status_idx" ON "rooms" ("status","started_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "room_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"max_seconds" integer,
	"billed_seconds" integer DEFAULT 0 NOT NULL,
	"charged_amount" integer DEFAULT 0 NOT NULL,
	"host_earning" integer DEFAULT 0 NOT NULL,
	"leave_reason" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "room_members_one_open_per_user_uq" ON "room_members" ("user_id") WHERE left_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "room_members_room_idx" ON "room_members" ("room_id","left_at");
--> statement-breakpoint
ALTER TABLE "gift_sends" ALTER COLUMN "session_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "gift_sends" ADD COLUMN IF NOT EXISTS "room_id" uuid;
