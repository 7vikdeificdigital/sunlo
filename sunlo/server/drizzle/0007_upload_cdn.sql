-- 0007: profile photo ka Cloudinary link (optional)
ALTER TABLE "uploads" ADD COLUMN IF NOT EXISTS "cdn_url" text;
