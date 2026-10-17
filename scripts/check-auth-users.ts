import { config } from "dotenv";
config({ path: ".env" });

import { db, ensureDbReady } from "../src/db";
import { account, user } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  await ensureDbReady();
  const users = await db
    .select({ id: user.id, email: user.email, name: user.name, status: user.status })
    .from(user);
  console.log("users", users);

  for (const u of users) {
    const accounts = await db
      .select({
        id: account.id,
        providerId: account.providerId,
        accountId: account.accountId,
        hasPassword: account.password,
      })
      .from(account)
      .where(eq(account.userId, u.id));
    console.log(
      u.email,
      accounts.map((a) => ({
        providerId: a.providerId,
        accountId: a.accountId,
        passwordLen: a.hasPassword?.length ?? 0,
      }))
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
