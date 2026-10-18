ALTER TABLE "competition_timeslots" ADD COLUMN IF NOT EXISTS "starts_at" text;--> statement-breakpoint
UPDATE "competition_timeslots" SET "starts_at" = '16:00' WHERE "starts_at" IS NULL OR "starts_at" = '';--> statement-breakpoint
ALTER TABLE "competition_timeslots" ALTER COLUMN "starts_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "competition_timeslots" DROP COLUMN IF EXISTS "label";
