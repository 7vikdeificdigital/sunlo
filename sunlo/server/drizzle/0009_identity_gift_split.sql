-- 0009: har user ka unique public ID + username, gift ka 50/50 split, referral ke naye niyam
CREATE SEQUENCE IF NOT EXISTS "user_public_id_seq" START WITH 50000001;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "public_id" bigint;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;
--> statement-breakpoint
UPDATE "users" u SET "public_id" = s.n FROM (SELECT o.id, nextval('user_public_id_seq') AS n FROM (SELECT id FROM "users" WHERE "public_id" IS NULL ORDER BY "created_at") o) s WHERE u.id = s.id;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "public_id" SET DEFAULT nextval('user_public_id_seq');
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "public_id" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_public_id_uniq" ON "users" ("public_id");
--> statement-breakpoint
UPDATE "users" SET "username" = 'user' || "public_id" WHERE "username" IS NULL AND "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_uniq" ON "users" (lower("username"));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION users_default_username() RETURNS trigger AS $$
BEGIN
  IF NEW.username IS NULL THEN NEW.username := 'user' || NEW.public_id; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS users_default_username_trg ON "users";
--> statement-breakpoint
CREATE TRIGGER users_default_username_trg BEFORE INSERT ON "users" FOR EACH ROW EXECUTE FUNCTION users_default_username();
--> statement-breakpoint
INSERT INTO "settings" ("key", "value") VALUES ('giftCommissionPct', '50'::jsonb), ('referrerBonusPaise', '5000'::jsonb), ('referralMinRechargePaise', '10000'::jsonb)
  ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";
