import { config } from "dotenv";
config({ path: ".env" });

import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import path from "path";
import { db, ensureDbReady, isPgliteMode } from "./index";

async function main() {
  await ensureDbReady();
  const folder = path.join(process.cwd(), "src/db/migrations");
  console.log(`Migrating (${isPgliteMode() ? "pglite" : "postgres"})...`);
  if (isPgliteMode()) {
    await migratePglite(db as Parameters<typeof migratePglite>[0], {
      migrationsFolder: folder,
    });
  } else {
    await migratePg(db as Parameters<typeof migratePg>[0], {
      migrationsFolder: folder,
    });
  }
  console.log("Migrations complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
