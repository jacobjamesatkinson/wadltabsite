import { config } from "dotenv";
config({ path: ".env" });

import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { db, ensureDbReady } from "../src/db";
import { account, user } from "../src/db/schema";

async function main() {
  await ensureDbReady();
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@wadl.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";

  const u = await db.query.user.findFirst({
    where: (t, { eq: e }) => e(t.email, email),
  });
  if (!u) {
    console.error("User not found", email);
    process.exit(1);
  }

  const [acc] = await db
    .select()
    .from(account)
    .where(eq(account.userId, u.id));

  if (!acc?.password) {
    console.error("No credential account");
    process.exit(1);
  }

  const okBefore = await verifyPassword({
    hash: acc.password,
    password,
  });
  console.log("verify before reset:", okBefore);

  const hashed = await hashPassword(password);
  await db
    .update(account)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(account.id, acc.id));

  const okAfter = await verifyPassword({ hash: hashed, password });
  console.log("verify after reset:", okAfter);
  console.log("Reset password for", email, "->", password);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
