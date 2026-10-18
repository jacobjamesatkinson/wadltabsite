import { config } from "dotenv";
config({ path: ".env" });

import { eq } from "drizzle-orm";
import { db, ensureDbReady } from "./index";
import { account, user, userRoles } from "./schema";
import { createId } from "../lib/id";
import { ensureSiteCompetition } from "../lib/competition";
import { hashPassword } from "better-auth/crypto";

/**
 * Minimal bootstrap — admin account + singleton site competition.
 * No demo institutions, teams, or venues.
 */
async function upsertAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@wadl.local";
  const name = process.env.SEED_ADMIN_NAME ?? "System Admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  const hashed = await hashPassword(password);

  const existing = await db.query.user.findFirst({
    where: (t, { eq: e }) => e(t.email, email),
  });

  let userId: string;
  if (existing) {
    userId = existing.id;
    const existingAccount = await db.query.account.findFirst({
      where: (t, { and, eq: e }) =>
        and(e(t.userId, existing.id), e(t.providerId, "credential")),
    });
    if (existingAccount) {
      await db
        .update(account)
        .set({ password: hashed, updatedAt: new Date() })
        .where(eq(account.id, existingAccount.id));
    } else {
      await db.insert(account).values({
        id: createId("acc"),
        accountId: existing.id,
        providerId: "credential",
        userId: existing.id,
        password: hashed,
      });
    }
  } else {
    userId = createId("usr");
    await db.insert(user).values({
      id: userId,
      name,
      email,
      emailVerified: true,
      status: "active",
    });
    await db.insert(account).values({
      id: createId("acc"),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashed,
    });
  }

  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  await db.insert(userRoles).values({
    id: createId("role"),
    userId,
    role: "admin",
  });

  return { email, password };
}

async function seed() {
  await ensureDbReady();
  console.log("Seeding bootstrap admin + site competition...");
  const admin = await upsertAdmin();
  const competition = await ensureSiteCompetition();
  console.log("Seed complete.");
  console.log("  Admin:", admin.email);
  console.log("  Competition:", competition.name);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
