ALTER TABLE "gifts" ADD COLUMN IF NOT EXISTS "media_type" text;
--> statement-breakpoint
ALTER TABLE "gifts" ADD COLUMN IF NOT EXISTS "thumb_data" bytea;
