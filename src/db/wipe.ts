import { config } from "dotenv";
config({ path: ".env" });

import { sql } from "drizzle-orm";
import { db, ensureDbReady, isPgliteMode } from "./index";

/** Domain + auth tables — truncate clears all seeded / demo rows. */
const TABLES = [
  "audit_events",
  "invitations",
  "postponement_requests",
  "speaker_deletion_requests",
  "team_access_tokens",
  "speaker_scores",
  "ballots",
  "adjudicator_assignments",
  "room_availability",
  "team_availability",
  "adjudicator_availability",
  "adjudicator_conflicts",
  "adjudicator_profiles",
  "draw_versions",
  "byes",
  "debates",
  "speakers",
  "teams",
  "competition_timeslots",
  "rounds",
  "rooms",
  "venues",
  "divisions",
  "competitions",
  "institution_memberships",
  "user_roles",
  "institutions",
  "session",
  "account",
  "verification",
  "user",
] as const;

async function wipe() {
  await ensureDbReady();
  console.log(`Wiping database (${isPgliteMode() ? "pglite" : "postgres"})...`);

  // CASCADE clears dependent rows even if FK order differs slightly.
  await db.execute(
    sql.raw(
      `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`
    )
  );

  console.log("All rows removed.");
}

wipe()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
