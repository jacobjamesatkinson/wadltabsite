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

function createPgliteDb(): AppDb {
  if (globalFor.wadlDb && globalFor.wadlPglite) return globalFor.wadlDb;

  const dataDir = pgliteDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  clearStalePgliteLock(dataDir);

  try {
    globalFor.wadlPglite = new PGlite(dataDir);
    globalFor.wadlDb = drizzlePglite(globalFor.wadlPglite, { schema });
    return globalFor.wadlDb;
  } catch (err) {
    clearStalePgliteLock(dataDir);
    globalFor.wadlPglite = new PGlite(dataDir);
    globalFor.wadlDb = drizzlePglite(globalFor.wadlPglite, { schema });
    return globalFor.wadlDb;
  }
}

function createPostgresDb(): AppDb {
  if (globalFor.wadlDb && globalFor.wadlPgClient) return globalFor.wadlDb;
  globalFor.wadlPgClient = postgres(process.env.DATABASE_URL!, {
    max: 10,
    prepare: false,
  });
  globalFor.wadlDb = drizzlePg(globalFor.wadlPgClient, { schema });
  return globalFor.wadlDb;
}

function getDb(): AppDb {
  if (globalFor.wadlDb) return globalFor.wadlDb;
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
