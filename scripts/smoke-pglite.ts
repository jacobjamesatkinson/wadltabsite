import { config } from "dotenv";
config({ path: ".env" });
process.env.DATABASE_URL = process.env.DATABASE_URL || "pglite";

import { ensureDbReady, db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  await ensureDbReady();
  const r = await db.execute(sql`select 1 as ok`);
  console.log("pglite ok", r);
  process.exit(0);
}

main().catch((err) => {
  console.error("pglite failed", err);
  process.exit(1);
});
