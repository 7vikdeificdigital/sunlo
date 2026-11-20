-- 0011: anonymous profile (@username se baat), user ke total minutes (level), level settings aur support email
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "anonymous" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "total_minutes" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
-- Purane users ke minute: poore ho chuke session se
UPDATE "users" u SET "total_minutes" = s.mins FROM (
  SELECT "user_id", COALESCE(SUM(CEIL("billed_seconds"::numeric / 60)), 0)::int AS mins
  FROM "consult_sessions" WHERE "status" = 'COMPLETED' GROUP BY "user_id"
) s WHERE u.id = s."user_id" AND u."total_minutes" = 0;
--> statement-breakpoint
INSERT INTO "settings" ("key", "value") VALUES
  ('supportEmail', '"support@bondty.com"'::jsonb),
  ('grievanceOfficerEmail', '"support@bondty.com"'::jsonb),
  ('lowBalanceWarnSec', '120'::jsonb),
  ('levelIntermediateMinutes', '500'::jsonb),
  ('levelExpertMinutes', '1500'::jsonb),
  ('coinPaiseBeginner', '80'::jsonb),
  ('coinPaiseIntermediate', '60'::jsonb),
  ('coinPaiseExpert', '50'::jsonb)
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";
