CREATE TYPE "public"."speaker_deletion_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "speaker_deletion_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"speaker_id" text NOT NULL,
	"team_id" text NOT NULL,
	"status" "speaker_deletion_status" DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "speaker_deletion_requests" ADD CONSTRAINT "speaker_deletion_requests_speaker_id_speakers_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."speakers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaker_deletion_requests" ADD CONSTRAINT "speaker_deletion_requests_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaker_deletion_requests" ADD CONSTRAINT "speaker_deletion_requests_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "speaker_deletion_team_idx" ON "speaker_deletion_requests" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "speaker_deletion_speaker_idx" ON "speaker_deletion_requests" USING btree ("speaker_id");
