import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema";

export function isPgliteMode() {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.startsWith("pglite:") || url === "pglite";
}

type AppDb =
  | ReturnType<typeof drizzlePg<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

const globalFor = globalThis as unknown as {
  wadlDb?: AppDb;
  wadlPglite?: PGlite;
  wadlPgClient?: ReturnType<typeof postgres>;
};

function pgliteDataDir() {
  const rawDir =
    process.env.PGLITE_DATA_DIR ||
    path.join(process.cwd(), "data", "pglite");
  if (typeof rawDir === "string" && rawDir.startsWith("file:")) {
    return fileURLToPath(rawDir);
  }
  return String(rawDir);
}

function clearStalePgliteLock(dataDir: string) {
  const pidFile = path.join(dataDir, "postmaster.pid");
  if (!fs.existsSync(pidFile)) return;
  try {
    fs.unlinkSync(pidFile);
  } catch {
    // ignore
  }
}

function ensurePgliteClient() {
  if (globalFor.wadlPglite) return globalFor.wadlPglite;

  const dataDir = pgliteDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  clearStalePgliteLock(dataDir);

  try {
    globalFor.wadlPglite = new PGlite(dataDir);
  } catch {
    clearStalePgliteLock(dataDir);
    globalFor.wadlPglite = new PGlite(dataDir);
  }
  return globalFor.wadlPglite;
}

/** Ensure recent schema columns exist when an old PGlite process skipped migration. */
async function ensureSchemaPatches(client: PGlite) {
  const tables = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'competitions'
     ) AS exists`
  );
  if (!tables.rows[0]?.exists) return;

  await client.query(
    `ALTER TABLE teams ADD COLUMN IF NOT EXISTS venue_id text`
  );
  await client.query(
    `ALTER TABLE teams ADD COLUMN IF NOT EXISTS timeslot_id text`
  );
  await client.query(
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS roster_day text`
  );

  const slots = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'competition_timeslots'
     ) AS exists`
  );
  if (!slots.rows[0]?.exists) return;

  await client.query(
    `ALTER TABLE competition_timeslots ADD COLUMN IF NOT EXISTS starts_at text`
  );
  try {
    await client.query(`
      UPDATE competition_timeslots
      SET starts_at = CASE
        WHEN label ~ '^[0-2][0-9]:[0-5][0-9]$' THEN label
        ELSE COALESCE(NULLIF(starts_at, ''), '16:00')
      END
      WHERE starts_at IS NULL OR starts_at = ''
    `);
  } catch {
    await client.query(
      `UPDATE competition_timeslots SET starts_at = '16:00' WHERE starts_at IS NULL OR starts_at = ''`
    );
  }
  try {
    await client.query(
      `ALTER TABLE competition_timeslots ALTER COLUMN starts_at SET NOT NULL`
    );
  } catch {
    // already NOT NULL
  }
  try {
    await client.query(
      `ALTER TABLE competition_timeslots DROP COLUMN IF EXISTS label`
    );
  } catch {
    // label already removed
  }

  // Draw rewrite columns (mirrors migration 0007 for long-lived dev DBs).
  await client.query(`ALTER TABLE debates ADD COLUMN IF NOT EXISTS bracket integer`);
  await client.query(`ALTER TABLE debates ADD COLUMN IF NOT EXISTS room_rank integer`);
  await client.query(
    `ALTER TABLE debates ADD COLUMN IF NOT EXISTS flags jsonb DEFAULT '[]'::jsonb NOT NULL`
  );
  await client.query(
    `ALTER TABLE draw_versions ADD COLUMN IF NOT EXISTS draw_type text DEFAULT 'power_paired' NOT NULL`
  );
  await client.query(`ALTER TABLE draw_versions ADD COLUMN IF NOT EXISTS options jsonb`);
  await client.query(
    `ALTER TABLE ballots ADD COLUMN IF NOT EXISTS version integer DEFAULT 1 NOT NULL`
  );
  await client.query(
    `ALTER TABLE ballots ADD COLUMN IF NOT EXISTS discarded boolean DEFAULT false NOT NULL`
  );
  await client.query(`ALTER TABLE ballots ADD COLUMN IF NOT EXISTS confirmed_by text`);
  await client.query(
    `ALTER TABLE adjudicator_availability ADD COLUMN IF NOT EXISTS round_id text`
  );

  // Repair venues that stored roster labels in address before roster_day existed.
  await client.query(`
    UPDATE venues
    SET roster_day = address, address = NULL
    WHERE roster_day IS NULL
      AND address IN (
        'Monday A', 'Tuesday A', 'Wednesday A', 'Thursday A', 'Friday A',
        'Monday B', 'Tuesday B', 'Wednesday B', 'Thursday B', 'Friday B'
      )
  `);

  // Speaker deletion requests (mirrors migration 0008).
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE speaker_deletion_status AS ENUM ('pending', 'approved', 'rejected');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS speaker_deletion_requests (
      id text PRIMARY KEY NOT NULL,
      speaker_id text NOT NULL REFERENCES speakers(id) ON DELETE cascade,
      team_id text NOT NULL REFERENCES teams(id) ON DELETE cascade,
      status speaker_deletion_status DEFAULT 'pending' NOT NULL,
      decided_by text REFERENCES "user"(id),
      decided_at timestamptz,
      created_at timestamptz DEFAULT now() NOT NULL
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS speaker_deletion_team_idx ON speaker_deletion_requests (team_id, status)`
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS speaker_deletion_speaker_idx ON speaker_deletion_requests (speaker_id)`
  );

  // Team identifiers are unique per division (mirrors migration 0009).
  await client.query(`DROP INDEX IF EXISTS team_competition_identifier`);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS team_competition_division_identifier
    ON teams (competition_id, division_id, identifier)
  `);
}

let schemaPatchPromise: Promise<void> | null = null;

function scheduleSchemaPatches(client: PGlite) {
  if (schemaPatchPromise) return schemaPatchPromise;
  schemaPatchPromise = client.waitReady
    .then(() => ensureSchemaPatches(client))
    .catch((err) => {
      schemaPatchPromise = null;
      console.error("[db] schema patch failed:", err);
    });
  return schemaPatchPromise;
}

function createPgliteDb(): AppDb {
  const client = ensurePgliteClient();
  void scheduleSchemaPatches(client);
  // Rebind drizzle when the schema gains tables (Turbopack HMR) so db.query stays current.
  const queryApi = globalFor.wadlDb?.query as Record<string, unknown> | undefined;
  if (
    !globalFor.wadlDb ||
    !queryApi?.competitionTimeslots ||
    !queryApi?.speakerScores ||
    !queryApi?.speakerDeletionRequests
  ) {
    globalFor.wadlDb = drizzlePglite(client, { schema });
  }
  return globalFor.wadlDb;
}

function createPostgresDb(): AppDb {
  if (globalFor.wadlDb && globalFor.wadlPgClient) {
    if (process.env.NODE_ENV !== "production") {
      globalFor.wadlDb = drizzlePg(globalFor.wadlPgClient, { schema });
    }
    return globalFor.wadlDb;
  }
  globalFor.wadlPgClient = postgres(process.env.DATABASE_URL!, {
    max: 10,
    prepare: false,
  });
  globalFor.wadlDb = drizzlePg(globalFor.wadlPgClient, { schema });
  return globalFor.wadlDb;
}

function getDb(): AppDb {
  return isPgliteMode() ? createPgliteDb() : createPostgresDb();
}

/** Lazily initialised database client. */
export const db = new Proxy({} as AppDb, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type Database = AppDb;

export async function ensureDbReady() {
  const real = getDb();
  if (isPgliteMode() && globalFor.wadlPglite) {
    try {
      await globalFor.wadlPglite.waitReady;
      await globalFor.wadlPglite.query("select 1");
      await scheduleSchemaPatches(globalFor.wadlPglite);
    } catch (err) {
      console.error(
        "[db] PGlite data appears corrupt or locked.",
        err instanceof Error ? err.message : err,
        "\nReset with: Remove-Item -Recurse -Force data\\pglite; pnpm db:setup"
      );
      throw err;
    }
  }
  return real;
}
