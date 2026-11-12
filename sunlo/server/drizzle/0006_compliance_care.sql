-- 0006: Sarkari niyam (IT Rules 2026, DPDP, CCPA, TDS) + naye features (free trial, mood match, scheduled calls, mood check-in)

-- Purani migration 0001 journal mein chhoot gayi thi: naye database par uploads.data column nahi banta tha
ALTER TABLE "uploads" ADD COLUMN IF NOT EXISTS "data" bytea;
--> statement-breakpoint
ALTER TYPE "txn_type" ADD VALUE IF NOT EXISTS 'TDS';
--> statement-breakpoint
ALTER TYPE "txn_type" ADD VALUE IF NOT EXISTS 'PAYMENT_REFUND';
--> statement-breakpoint

-- ---------- Users: consent (DPDP), umar, admin 2FA, check-in reminder ----------
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "date_of_birth" date;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_version" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret_enc" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "checkin_reminder" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "checkin_reminded_on" date;
--> statement-breakpoint

-- ---------- Vendors: PAN (TDS ke liye), encrypted ----------
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "pan_enc" text;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "pan_last4" text;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "pan_name" text;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "pan_added_at" timestamp with time zone;
--> statement-breakpoint

-- ---------- Sessions: free trial, TDS, kam-balance chetavani, keemat ki pushti ----------
ALTER TABLE "consult_sessions" ADD COLUMN IF NOT EXISTS "free_seconds" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "consult_sessions" ADD COLUMN IF NOT EXISTS "promo_amount" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "consult_sessions" ADD COLUMN IF NOT EXISTS "tds_amount" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "consult_sessions" ADD COLUMN IF NOT EXISTS "pricing_ack_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "consult_sessions" ADD COLUMN IF NOT EXISTS "low_balance_warned_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "consult_sessions" ADD COLUMN IF NOT EXISTS "scheduled_call_id" uuid;
--> statement-breakpoint

-- ---------- Support / grievance: SLA (IT Rules 2026: 7 din; ghair-kanooni content 36 ghante) ----------
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'GENERAL' NOT NULL;
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "acknowledged_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "due_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "closed_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "support_tickets" SET "due_at" = "created_at" + interval '7 days', "acknowledged_at" = COALESCE("acknowledged_at", "created_at") WHERE "due_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_due_idx" ON "support_tickets" ("status","due_at");
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "due_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "reports" SET "due_at" = "created_at" + interval '36 hours' WHERE "due_at" IS NULL;
--> statement-breakpoint

-- ---------- Withdrawals: TDS ka hisaab ----------
ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "pan_last4" text;
--> statement-breakpoint

-- ---------- Sarkari / court order par content hatana (IT Rules 2026: 3 ghante) ----------
CREATE TABLE IF NOT EXISTS "takedowns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"authority" text NOT NULL,
	"order_ref" text NOT NULL,
	"note" text,
	"received_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"actioned_at" timestamp with time zone NOT NULL,
	"actioned_by" uuid NOT NULL REFERENCES "users"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "takedowns_target_chk" CHECK ("target_type" IN ('USER','VENDOR','MESSAGE','ROOM','VOICE_NOTE','REVIEW'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "takedowns_created_idx" ON "takedowns" ("created_at");
--> statement-breakpoint

-- ---------- Free trial: ek phone number = ek hi baar (account delete karke dobara nahi) ----------
CREATE TABLE IF NOT EXISTS "trial_claims" (
	"phone_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id"),
	"session_id" uuid NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ---------- Call schedule ----------
CREATE TABLE IF NOT EXISTS "scheduled_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id"),
	"vendor_id" uuid NOT NULL REFERENCES "vendors"("id"),
	"type" "session_type" NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"note" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"decline_reason" text,
	"reminded_at" timestamp with time zone,
	"session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sc_status_chk" CHECK ("status" IN ('PENDING','CONFIRMED','DECLINED','CANCELLED','COMPLETED','MISSED')),
	CONSTRAINT "sc_duration_chk" CHECK ("duration_min" IN (15, 30, 45, 60))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sc_vendor_time_idx" ON "scheduled_calls" ("vendor_id","scheduled_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sc_user_time_idx" ON "scheduled_calls" ("user_id","scheduled_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sc_status_time_idx" ON "scheduled_calls" ("status","scheduled_at");
--> statement-breakpoint

-- ---------- Roz ka mood check-in ----------
CREATE TABLE IF NOT EXISTS "mood_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id"),
	"day" date NOT NULL,
	"mood" integer NOT NULL,
	"note_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mood_range_chk" CHECK ("mood" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mood_user_day_uq" ON "mood_checkins" ("user_id","day");
