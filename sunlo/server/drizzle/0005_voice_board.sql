CREATE TABLE IF NOT EXISTS "voice_clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL REFERENCES "users"("id"),
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"duration_sec" integer NOT NULL,
	"storage_key" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voice_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id"),
	"clip_id" uuid NOT NULL REFERENCES "voice_clips"("id"),
	"topic" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"chosen_vendor_id" uuid REFERENCES "vendors"("id"),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_notes_open_idx" ON "voice_notes" ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_notes_user_idx" ON "voice_notes" ("user_id","created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voice_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL REFERENCES "voice_notes"("id") ON DELETE CASCADE,
	"vendor_id" uuid NOT NULL REFERENCES "vendors"("id"),
	"clip_id" uuid NOT NULL REFERENCES "voice_clips"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "voice_replies_one_per_vendor_uq" ON "voice_replies" ("note_id","vendor_id");
