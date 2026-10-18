-- Draw rewrite: competition timeslots everywhere, debate brackets/flags, draw options,
-- speaker scores and ballot versioning. Destructive for per-round timeslots.

-- Debates now reference competition timeslots.
ALTER TABLE "debates" DROP CONSTRAINT IF EXISTS "debates_timeslot_id_timeslots_id_fk";--> statement-breakpoint
UPDATE "debates" SET "timeslot_id" = NULL WHERE "timeslot_id" IS NOT NULL AND "timeslot_id" NOT IN (SELECT "id" FROM "competition_timeslots");--> statement-breakpoint
ALTER TABLE "debates" ADD CONSTRAINT "debates_timeslot_id_competition_timeslots_id_fk" FOREIGN KEY ("timeslot_id") REFERENCES "public"."competition_timeslots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debates" ADD COLUMN IF NOT EXISTS "bracket" integer;--> statement-breakpoint
ALTER TABLE "debates" ADD COLUMN IF NOT EXISTS "room_rank" integer;--> statement-breakpoint
ALTER TABLE "debates" ADD COLUMN IF NOT EXISTS "flags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint

-- Draw versions remember which generator/options produced them.
ALTER TABLE "draw_versions" ADD COLUMN IF NOT EXISTS "draw_type" text DEFAULT 'power_paired' NOT NULL;--> statement-breakpoint
ALTER TABLE "draw_versions" ADD COLUMN IF NOT EXISTS "options" jsonb;--> statement-breakpoint

-- Adjudicator availability is per round + competition timeslot.
DROP TABLE IF EXISTS "adjudicator_availability" CASCADE;--> statement-breakpoint
CREATE TABLE "adjudicator_availability" (
	"id" text PRIMARY KEY NOT NULL,
	"adjudicator_id" text NOT NULL,
	"round_id" text NOT NULL,
	"timeslot_id" text NOT NULL,
	"available" boolean DEFAULT true NOT NULL
);--> statement-breakpoint
ALTER TABLE "adjudicator_availability" ADD CONSTRAINT "adjudicator_availability_adjudicator_id_adjudicator_profiles_id_fk" FOREIGN KEY ("adjudicator_id") REFERENCES "public"."adjudicator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjudicator_availability" ADD CONSTRAINT "adjudicator_availability_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjudicator_availability" ADD CONSTRAINT "adjudicator_availability_timeslot_id_competition_timeslots_id_fk" FOREIGN KEY ("timeslot_id") REFERENCES "public"."competition_timeslots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adj_availability_unique" ON "adjudicator_availability" USING btree ("adjudicator_id","round_id","timeslot_id");--> statement-breakpoint

-- Per-round timeslots are gone.
DROP TABLE IF EXISTS "timeslots" CASCADE;--> statement-breakpoint

-- Ballot versioning + confirmation.
ALTER TABLE "ballots" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ballots" ADD COLUMN IF NOT EXISTS "discarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ballots" ADD COLUMN IF NOT EXISTS "confirmed_by" text;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Speaker scores.
CREATE TABLE IF NOT EXISTS "speaker_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"ballot_id" text NOT NULL,
	"debate_id" text NOT NULL,
	"team_id" text NOT NULL,
	"speaker_id" text,
	"position" integer NOT NULL,
	"score_hundredths" integer NOT NULL,
	"ghost" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
ALTER TABLE "speaker_scores" ADD CONSTRAINT "speaker_scores_ballot_id_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaker_scores" ADD CONSTRAINT "speaker_scores_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaker_scores" ADD CONSTRAINT "speaker_scores_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaker_scores" ADD CONSTRAINT "speaker_scores_speaker_id_speakers_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."speakers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "speaker_scores_ballot_idx" ON "speaker_scores" USING btree ("ballot_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "speaker_scores_unique" ON "speaker_scores" USING btree ("ballot_id","team_id","position");
