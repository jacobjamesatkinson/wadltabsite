import { config } from "dotenv";
config({ path: ".env" });
process.env.DATABASE_URL = process.env.DATABASE_URL || "pglite";

import { sql } from "drizzle-orm";
import { db, ensureDbReady } from "../src/db";

async function main() {
  await ensureDbReady();
  await db.execute(
    sql`ALTER TABLE team_access_tokens ADD COLUMN IF NOT EXISTS access_token text`
  );
  try {
    await db.execute(
      sql`ALTER TABLE team_access_tokens ADD CONSTRAINT team_access_tokens_access_token_unique UNIQUE (access_token)`
    );
  } catch (err) {
    console.warn("Unique constraint may already exist:", err);
  }
  // Mark migration applied if journal supports it — best-effort for local pglite
  console.log("access_token column ready");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
