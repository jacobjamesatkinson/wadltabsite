CREATE TABLE "room_availability" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"round_id" text NOT NULL,
	"available" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_availability" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"round_id" text NOT NULL,
	"available" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "room_availability" ADD CONSTRAINT "room_availability_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_availability" ADD CONSTRAINT "room_availability_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_availability" ADD CONSTRAINT "team_availability_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_availability" ADD CONSTRAINT "team_availability_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "room_availability_unique" ON "room_availability" USING btree ("room_id","round_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_availability_unique" ON "team_availability" USING btree ("team_id","round_id");