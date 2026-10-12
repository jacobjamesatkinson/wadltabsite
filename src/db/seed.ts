import { config } from "dotenv";
config({ path: ".env" });

import { eq } from "drizzle-orm";
import { db, ensureDbReady } from "./index";
import {
  adjudicatorAvailability,
  adjudicatorProfiles,
  competitions,
  defaultCompetitionConfig,
  divisions,
  institutionMemberships,
  institutions,
  rooms,
  rounds,
  speakers,
  teams,
  timeslots,
  user,
  userRoles,
  venues,
  account,
} from "./schema";
import { createId } from "../lib/id";
import { hashPassword } from "better-auth/crypto";

async function upsertUser(params: {
  email: string;
  name: string;
  password: string;
}) {
  const existing = await db.query.user.findFirst({
    where: (t, { eq: e }) => e(t.email, params.email),
  });
  if (existing) return existing;

  const id = createId("usr");
  await db.insert(user).values({
    id,
    name: params.name,
    email: params.email,
    emailVerified: true,
    status: "active",
  });
  const hashed = await hashPassword(params.password);
  await db.insert(account).values({
    id: createId("acc"),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: hashed,
  });
  return (await db.query.user.findFirst({
    where: (t, { eq: e }) => e(t.id, id),
  }))!;
}

async function seed() {
  await ensureDbReady();
  console.log("Seeding database...");

  const admin = await upsertUser({
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@wadl.local",
    name: "System Admin",
    password: process.env.SEED_ADMIN_PASSWORD ?? "Admin123!",
  });
  const coordinator = await upsertUser({
    email: process.env.SEED_COORDINATOR_EMAIL ?? "coordinator@wadl.local",
    name: "Alex Coordinator",
    password: process.env.SEED_COORDINATOR_PASSWORD ?? "Coord123!",
  });
  const adjudicator = await upsertUser({
    email: process.env.SEED_ADJUDICATOR_EMAIL ?? "adjudicator@wadl.local",
    name: "Jordan Adjudicator",
    password: process.env.SEED_ADJUDICATOR_PASSWORD ?? "Adj123!",
  });
  const headAdj = await upsertUser({
    email: "headadj@wadl.local",
    name: "Sam Head Adjudicator",
    password: "HeadAdj123!",
  });

  // Clear and recreate demo competition data if competition exists
  const existingComp = await db.query.competitions.findFirst({
    where: (t, { eq: e }) => e(t.shortName, "WADL2026"),
  });
  if (existingComp) {
    console.log("Seed data already present (WADL2026). Updating roles only.");
  }

  const instAId = existingComp ? null : createId("inst");
  const instBId = existingComp ? null : createId("inst");

  let institutionA = await db.query.institutions.findFirst({
    where: (t, { eq: e }) => e(t.shortName, "PERTH"),
  });
  let institutionB = await db.query.institutions.findFirst({
    where: (t, { eq: e }) => e(t.shortName, "FREM"),
  });

  if (!institutionA) {
    const id = instAId ?? createId("inst");
    await db.insert(institutions).values({
      id,
      name: "Perth Senior High School",
      shortName: "PERTH",
    });
    institutionA = (await db.query.institutions.findFirst({
      where: (t, { eq: e }) => e(t.id, id),
    }))!;
  }
  if (!institutionB) {
    const id = instBId ?? createId("inst");
    await db.insert(institutions).values({
      id,
      name: "Fremantle College",
      shortName: "FREM",
    });
    institutionB = (await db.query.institutions.findFirst({
      where: (t, { eq: e }) => e(t.id, id),
    }))!;
  }

  // Roles
  await db.delete(userRoles).where(eq(userRoles.userId, admin.id));
  await db.insert(userRoles).values({
    id: createId("role"),
    userId: admin.id,
    role: "admin",
  });

  await db.delete(userRoles).where(eq(userRoles.userId, coordinator.id));
  await db.insert(userRoles).values({
    id: createId("role"),
    userId: coordinator.id,
    role: "coordinator",
    institutionId: institutionA.id,
  });
  await db.delete(institutionMemberships).where(eq(institutionMemberships.userId, coordinator.id));
  await db.insert(institutionMemberships).values({
    id: createId("mem"),
    userId: coordinator.id,
    institutionId: institutionA.id,
    permission: "coordinator",
  });

  await db.delete(userRoles).where(eq(userRoles.userId, adjudicator.id));
  await db.insert(userRoles).values({
    id: createId("role"),
    userId: adjudicator.id,
    role: "adjudicator",
  });

  let competition = await db.query.competitions.findFirst({
    where: (t, { eq: e }) => e(t.shortName, "WADL2026"),
  });

  if (!competition) {
    const competitionId = createId("comp");
    await db.insert(competitions).values({
      id: competitionId,
      name: "WADL Season 2026",
      shortName: "WADL2026",
      season: "2026",
      status: "running",
      config: defaultCompetitionConfig,
    });
    competition = (await db.query.competitions.findFirst({
      where: (t, { eq: e }) => e(t.id, competitionId),
    }))!;

    const venueId = createId("ven");
    await db.insert(venues).values({
      id: venueId,
      name: "UWA Arts Building",
      address: "35 Stirling Highway, Crawley WA",
    });

    const roomIds = ["R1", "R2", "R3", "R4"].map((identifier) => {
      const id = createId("room");
      return { id, identifier };
    });
    await db.insert(rooms).values(
      roomIds.map((r) => ({
        id: r.id,
        venueId,
        identifier: r.identifier,
        capacity: 30,
      }))
    );

    const divNovice = createId("div");
    const divJunior = createId("div");
    const divSenior = createId("div");
    await db.insert(divisions).values([
      {
        id: divNovice,
        competitionId,
        name: "Novice A",
        level: "novice",
        venueId,
      },
      {
        id: divJunior,
        competitionId,
        name: "Junior A",
        level: "junior",
        venueId,
      },
      {
        id: divSenior,
        competitionId,
        name: "Senior A",
        level: "senior",
        venueId,
      },
    ]);

    const roundId = createId("rnd");
    await db.insert(rounds).values({
      id: roundId,
      competitionId,
      number: 1,
      name: "Round 1",
      date: new Date(),
      drawStatus: "none",
    });

    const ts1 = createId("ts");
    const ts2 = createId("ts");
    const start = new Date();
    start.setHours(16, 0, 0, 0);
    const start2 = new Date(start);
    start2.setHours(18, 0, 0, 0);
    await db.insert(timeslots).values([
      {
        id: ts1,
        roundId,
        label: "4:00 PM",
        startsAt: start,
        sortOrder: 0,
      },
      {
        id: ts2,
        roundId,
        label: "6:00 PM",
        startsAt: start2,
        sortOrder: 1,
      },
    ]);

    const teamDefs = [
      { name: "Perth 1", identifier: "PERTH-1", inst: institutionA.id, div: divJunior, wins: 0 },
      { name: "Perth 2", identifier: "PERTH-2", inst: institutionA.id, div: divJunior, wins: 0 },
      { name: "Fremantle 1", identifier: "FREM-1", inst: institutionB.id, div: divJunior, wins: 0 },
      { name: "Fremantle 2", identifier: "FREM-2", inst: institutionB.id, div: divJunior, wins: 0 },
      { name: "Perth Senior 1", identifier: "PERTH-S1", inst: institutionA.id, div: divSenior, wins: 0 },
      { name: "Fremantle Senior 1", identifier: "FREM-S1", inst: institutionB.id, div: divSenior, wins: 0 },
    ];

    for (const t of teamDefs) {
      const teamId = createId("team");
      await db.insert(teams).values({
        id: teamId,
        competitionId,
        institutionId: t.inst,
        divisionId: t.div,
        name: t.name,
        identifier: t.identifier,
        wins: t.wins,
      });
      await db.insert(speakers).values([
        { id: createId("spk"), teamId, name: `${t.name} Speaker A` },
        { id: createId("spk"), teamId, name: `${t.name} Speaker B` },
        { id: createId("spk"), teamId, name: `${t.name} Speaker C` },
      ]);
    }

    await db.delete(userRoles).where(eq(userRoles.userId, headAdj.id));
    await db.insert(userRoles).values({
      id: createId("role"),
      userId: headAdj.id,
      role: "head_adjudicator",
      competitionId,
      venueId,
    });

    const adjProfileId = createId("adj");
    await db.insert(adjudicatorProfiles).values({
      id: adjProfileId,
      userId: adjudicator.id,
      qualifications: "Experienced school adjudicator",
      active: true,
    });

    const haProfileId = createId("adj");
    await db.insert(adjudicatorProfiles).values({
      id: haProfileId,
      userId: headAdj.id,
      qualifications: "Head adjudicator",
      active: true,
    });

    await db.insert(adjudicatorAvailability).values([
      { id: createId("av"), adjudicatorId: adjProfileId, timeslotId: ts1, available: true },
      { id: createId("av"), adjudicatorId: adjProfileId, timeslotId: ts2, available: true },
      { id: createId("av"), adjudicatorId: haProfileId, timeslotId: ts1, available: true },
      { id: createId("av"), adjudicatorId: haProfileId, timeslotId: ts2, available: true },
    ]);
  } else {
    await db.delete(userRoles).where(eq(userRoles.userId, headAdj.id));
    await db.insert(userRoles).values({
      id: createId("role"),
      userId: headAdj.id,
      role: "head_adjudicator",
      competitionId: competition.id,
    });

    const existingAdj = await db.query.adjudicatorProfiles.findFirst({
      where: (t, { eq: e }) => e(t.userId, adjudicator.id),
    });
    if (!existingAdj) {
      await db.insert(adjudicatorProfiles).values({
        id: createId("adj"),
        userId: adjudicator.id,
        active: true,
      });
    }
  }

  console.log("Seed complete.");
  console.log("  Admin:       ", process.env.SEED_ADMIN_EMAIL ?? "admin@wadl.local");
  console.log("  Coordinator: ", process.env.SEED_COORDINATOR_EMAIL ?? "coordinator@wadl.local");
  console.log("  Adjudicator: ", process.env.SEED_ADJUDICATOR_EMAIL ?? "adjudicator@wadl.local");
  console.log("  Head Adj:     headadj@wadl.local / HeadAdj123!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
