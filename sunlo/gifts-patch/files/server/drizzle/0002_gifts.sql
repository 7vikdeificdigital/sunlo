CREATE TABLE IF NOT EXISTS "gifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT '🎁' NOT NULL,
	"price" integer NOT NULL,
	"svga_data" bytea,
	"svga_version" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gifts_price_positive" CHECK ("price" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gift_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"gift_id" uuid NOT NULL,
	"gift_name" text NOT NULL,
	"price" integer NOT NULL,
	"commission_pct" integer NOT NULL,
	"vendor_earning" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gift_sends_created_idx" ON "gift_sends" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gift_sends_session_idx" ON "gift_sends" ("session_id");
--> statement-breakpoint
INSERT INTO "gifts" ("name","icon","price","sort_order") VALUES
 ('Gulaab','🌹',1000,1),
 ('Dil','❤️',2500,2),
 ('Chocolate','🍫',5000,3),
 ('Taaj','👑',10000,4),
 ('Rocket','🚀',50000,5);
