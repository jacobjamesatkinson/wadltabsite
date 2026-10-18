CREATE TABLE "competition_timeslots" (
	"id" text PRIMARY KEY NOT NULL,
	"competition_id" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "venue_id" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "timeslot_id" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "roster_day" text;--> statement-breakpoint
ALTER TABLE "competition_timeslots" ADD CONSTRAINT "competition_timeslots_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_timeslot_id_competition_timeslots_id_fk" FOREIGN KEY ("timeslot_id") REFERENCES "public"."competition_timeslots"("id") ON DELETE no action ON UPDATE no action;