-- 0010: har listener (vendor) ka unique public ID (BOL...). User ka ID BOU + users.public_id hai.
CREATE SEQUENCE IF NOT EXISTS "vendor_public_id_seq" START WITH 10000001;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "public_id" bigint;
--> statement-breakpoint
UPDATE "vendors" v SET "public_id" = s.n FROM (SELECT o.id, nextval('vendor_public_id_seq') AS n FROM (SELECT id FROM "vendors" WHERE "public_id" IS NULL ORDER BY "created_at") o) s WHERE v.id = s.id;
--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "public_id" SET DEFAULT nextval('vendor_public_id_seq');
--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "public_id" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_public_id_uniq" ON "vendors" ("public_id");
