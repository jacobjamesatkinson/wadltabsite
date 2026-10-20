DROP INDEX IF EXISTS "team_competition_identifier";--> statement-breakpoint
CREATE UNIQUE INDEX "team_competition_division_identifier" ON "teams" USING btree ("competition_id","division_id","identifier");
