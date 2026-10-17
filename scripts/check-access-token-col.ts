import { config } from "dotenv";
config({ path: ".env" });
import { sql } from "drizzle-orm";
import { db, ensureDbReady } from "../src/db";

async function main() {
  await ensureDbReady();
  const rows = await db.execute(
    sql`select column_name from information_schema.columns where table_name = 'team_access_tokens' order by ordinal_position`
  );
  console.log(rows);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
