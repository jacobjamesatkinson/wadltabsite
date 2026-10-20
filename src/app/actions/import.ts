"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db } from "@/db";
import {
  account,
  adjudicatorProfiles,
  competitionTimeslots,
  divisions,
  institutions,
  rooms,
  teams,
  user,
  userRoles,
  venues,
} from "@/db/schema";
import { ROSTER_DAYS } from "@/db/schema/domain";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { ensureSiteCompetition } from "@/lib/competition";
import { cell, parseCsv, type ImportKind } from "@/lib/csv/parse";
import { createId } from "@/lib/id";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { buildTeamIdentifier } from "@/lib/teams/display-name";
import { parseTimeslotTime } from "@/lib/timeslots/format";

export type ImportRowResult = {
  row: number;
  status: "created" | "updated" | "skipped" | "error";
  message: string;
};

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  results: ImportRowResult[];
};

const kindSchema = z.enum([
  "institutions",
  "teams",
  "venues",
  "rooms",
  "adjudicators",
]);

export async function importCsvPaste(input: {
  kind: ImportKind;
  csv: string;
}): Promise<ImportResult> {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");

  const kind = kindSchema.parse(input.kind);
  const csv = z.string().min(1).parse(input.csv);
  const { rows } = parseCsv(csv);
  if (rows.length === 0) throw new Error("No data rows found");

  let result: ImportResult;
  switch (kind) {
    case "institutions":
      requirePermission(ctx, "institutions:manage");
      result = await importInstitutions(ctx.userId, rows);
      break;
    case "teams":
      if (!hasPermission(ctx, "teams:manage_all")) throw new Error("FORBIDDEN");
      result = await importTeams(ctx.userId, rows);
      break;
    case "venues":
      requirePermission(ctx, "venues:manage");
      result = await importVenues(ctx.userId, rows);
      break;
    case "rooms":
      requirePermission(ctx, "venues:manage");
      result = await importRooms(ctx.userId, rows);
      break;
    case "adjudicators":
      requirePermission(ctx, "adjudicators:manage");
      result = await importAdjudicators(ctx.userId, rows);
      break;
  }

  await writeAudit({
    actorId: ctx.userId,
    action: `import.${kind}`,
    entityType: "import",
    entityId: kind,
    details: {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
    },
  });

  revalidatePath("/admin/settings/importer");
  revalidatePath("/admin/institutions");
  revalidatePath("/admin/teams");
  revalidatePath("/admin/venues");
  revalidatePath("/admin/adjudicators");
  revalidatePath("/admin/accounts");
  revalidatePath("/");

  return result;
}

function tally(results: ImportRowResult[]): ImportResult {
  return {
    created: results.filter((r) => r.status === "created").length,
    updated: results.filter((r) => r.status === "updated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  };
}

async function importInstitutions(
  actorId: string,
  rows: Array<Record<string, string>>
) {
  const results: ImportRowResult[] = [];
  const existingRows = await db.select().from(institutions);
  const byShort = new Map(
    existingRows.map((i) => [i.shortName.toLowerCase(), i])
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const line = i + 2;
    try {
      const name = cell(row, "name");
      const shortName = cell(row, "shortName", "short", "code").trim();
      if (!name || !shortName) {
        throw new Error("name and shortName are required");
      }
      const key = shortName.toLowerCase();
      const existing = byShort.get(key);
      if (existing) {
        await db
          .update(institutions)
          .set({
            name,
            shortName,
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(institutions.id, existing.id));
        byShort.set(key, { ...existing, name, shortName, status: "active" });
        await writeAudit({
          actorId,
          action: "institution.update",
          entityType: "institution",
          entityId: existing.id,
          details: { name, shortName, via: "csv" },
        });
        results.push({
          row: line,
          status: "updated",
          message: `${shortName} — ${name}`,
        });
        continue;
      }
      const id = createId("inst");
      await db.insert(institutions).values({ id, name, shortName });
      byShort.set(key, {
        id,
        name,
        shortName,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await writeAudit({
        actorId,
        action: "institution.create",
        entityType: "institution",
        entityId: id,
        details: { name, shortName, via: "csv" },
      });
      results.push({
        row: line,
        status: "created",
        message: `${shortName} — ${name}`,
      });
    } catch (err) {
      results.push({
        row: line,
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
    }
  }
  return tally(results);
}

async function importTeams(
  actorId: string,
  rows: Array<Record<string, string>>
) {
  const competition = await ensureSiteCompetition();

  const [institutionRows, divisionRows, venueRows, slots] = await Promise.all([
    db.select().from(institutions),
    db
      .select()
      .from(divisions)
      .where(eq(divisions.competitionId, competition.id)),
    db.select().from(venues),
    db
      .select()
      .from(competitionTimeslots)
      .where(eq(competitionTimeslots.competitionId, competition.id)),
  ]);

  const instByShort = new Map(
    institutionRows.map((i) => [i.shortName.toUpperCase(), i])
  );
  const divByName = new Map(
    divisionRows.map((d) => [d.name.trim().toLowerCase(), d])
  );
  const venueByName = new Map(
    venueRows.map((v) => [v.name.trim().toLowerCase(), v])
  );
  const slotByTime = new Map(slots.map((s) => [s.startsAt, s]));

  // Keyed by divisionId + identifier so the same number can exist across divisions.
  const existingTeams = await db
    .select()
    .from(teams)
    .where(eq(teams.competitionId, competition.id));
  const byDivisionIdentifier = new Map(
    existingTeams.map((t) => [
      `${t.divisionId ?? ""}:${t.identifier.toUpperCase()}`,
      t,
    ])
  );

  const results: ImportRowResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const line = i + 2;
    try {
      const instShort = cell(row, "institution", "institutionShortName").toUpperCase();
      const name = cell(row, "name", "team", "teamNumber");
      const divisionName = cell(row, "division");
      const identifierIn = cell(row, "identifier", "id");
      const venueName = cell(row, "venue");
      const timeslotRaw = cell(row, "timeslot", "time", "startsAt");

      if (!name) throw new Error("name is required");
      if (!divisionName) throw new Error("division is required");

      const division = divByName.get(divisionName.toLowerCase());
      if (!division) throw new Error(`Unknown division "${divisionName}"`);

      let institutionId: string | null = null;
      let institution: { shortName: string } | null = null;
      if (instShort) {
        const inst = instByShort.get(instShort);
        if (!inst) throw new Error(`Unknown institution "${instShort}"`);
        institutionId = inst.id;
        institution = inst;
        if (!/^\d+$/.test(name)) {
          throw new Error("Institution teams need a numeric name (e.g. 1)");
        }
      }

      const identifier = (
        identifierIn || buildTeamIdentifier(name, institution)
      ).toUpperCase();

      let venueId: string | null = null;
      if (venueName) {
        const venue = venueByName.get(venueName.toLowerCase());
        if (!venue) throw new Error(`Unknown venue "${venueName}"`);
        venueId = venue.id;
      }

      let timeslotId: string | null = null;
      if (timeslotRaw) {
        const startsAt = parseTimeslotTime(timeslotRaw);
        const slot = slotByTime.get(startsAt);
        if (!slot) throw new Error(`Unknown timeslot "${timeslotRaw}"`);
        timeslotId = slot.id;
      }

      const mapKey = `${division.id}:${identifier}`;
      const existing =
        byDivisionIdentifier.get(mapKey) ??
        // Legacy rows with no division: claim them for this import's division.
        byDivisionIdentifier.get(`:${identifier}`);

      if (existing) {
        await db
          .update(teams)
          .set({
            institutionId,
            divisionId: division.id,
            venueId,
            timeslotId,
            name,
            identifier,
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(teams.id, existing.id));
        const updated = {
          ...existing,
          institutionId,
          divisionId: division.id,
          venueId,
          timeslotId,
          name,
          identifier,
          status: "active",
        };
        if (!existing.divisionId) {
          byDivisionIdentifier.delete(`:${identifier}`);
        }
        byDivisionIdentifier.set(mapKey, updated);
        await writeAudit({
          actorId,
          action: "team.update",
          entityType: "team",
          entityId: existing.id,
          details: { identifier, division: division.name, via: "csv" },
        });
        results.push({
          row: line,
          status: "updated",
          message: `${identifier} (${division.name})`,
        });
        continue;
      }

      const id = createId("team");
      try {
        await db
          .insert(teams)
          .values({
            id,
            competitionId: competition.id,
            institutionId,
            divisionId: division.id,
            venueId,
            timeslotId,
            name,
            identifier,
          })
          .onConflictDoUpdate({
            target: [teams.competitionId, teams.divisionId, teams.identifier],
            set: {
              institutionId,
              venueId,
              timeslotId,
              name,
              status: "active",
              updatedAt: new Date(),
            },
          });
      } catch (err) {
        throw new Error(formatTeamImportDbError(err, identifier, division.name));
      }

      const [saved] = await db
        .select()
        .from(teams)
        .where(
          and(
            eq(teams.competitionId, competition.id),
            eq(teams.divisionId, division.id),
            eq(teams.identifier, identifier)
          )
        )
        .limit(1);
      if (saved) {
        byDivisionIdentifier.set(mapKey, saved);
      }

      const wasUpdate = saved?.id !== id;
      await writeAudit({
        actorId,
        action: wasUpdate ? "team.update" : "team.create",
        entityType: "team",
        entityId: saved?.id ?? id,
        details: { identifier, division: division.name, via: "csv" },
      });
      results.push({
        row: line,
        status: wasUpdate ? "updated" : "created",
        message: `${identifier} (${division.name})`,
      });
    } catch (err) {
      results.push({
        row: line,
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
    }
  }
  return tally(results);
}

function formatTeamImportDbError(
  err: unknown,
  identifier: string,
  divisionName: string
): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/unique|duplicate|23505/i.test(raw)) {
    return `Team ${identifier} already exists in another division — restart the app if you just updated uniqueness rules, then retry`;
  }
  // Drizzle wraps the SQL; keep the useful tail when possible.
  const short = raw.replace(/^Failed query:\s*/i, "").slice(0, 180);
  return short || `Could not save ${identifier} (${divisionName})`;
}

async function importVenues(
  actorId: string,
  rows: Array<Record<string, string>>
) {
  const results: ImportRowResult[] = [];
  const existingVenues = await db.select().from(venues);
  const byName = new Map(
    existingVenues.map((v) => [v.name.trim().toLowerCase(), v])
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const line = i + 2;
    try {
      const name = cell(row, "name", "venue", "venueName");
      let address = cell(row, "address");
      const rosterDayRaw = cell(row, "rosterDay", "roster", "day");

      if (!name) throw new Error("name is required");

      let rosterDay: string | null = null;
      if (rosterDayRaw) {
        const match = ROSTER_DAYS.find(
          (d) => d.toLowerCase() === rosterDayRaw.toLowerCase()
        );
        if (!match) {
          throw new Error(
            `Invalid rosterDay "${rosterDayRaw}" (e.g. Monday A)`
          );
        }
        rosterDay = match;
      } else if (address) {
        // Common CSV mistake: roster label put in the address column.
        const match = ROSTER_DAYS.find(
          (d) => d.toLowerCase() === address.toLowerCase()
        );
        if (match) {
          rosterDay = match;
          address = "";
        }
      }

      const key = name.trim().toLowerCase();
      const existing = byName.get(key);
      if (existing) {
        await db
          .update(venues)
          .set({
            name: name.trim(),
            address: address || existing.address,
            rosterDay: rosterDay ?? existing.rosterDay,
            updatedAt: new Date(),
          })
          .where(eq(venues.id, existing.id));
        byName.set(key, {
          ...existing,
          name: name.trim(),
          address: address || existing.address,
          rosterDay: rosterDay ?? existing.rosterDay,
        });
        await writeAudit({
          actorId,
          action: "venue.update",
          entityType: "venue",
          entityId: existing.id,
          details: { name, via: "csv" },
        });
        results.push({
          row: line,
          status: "updated",
          message: name.trim(),
        });
        continue;
      }

      const id = createId("ven");
      await db.insert(venues).values({
        id,
        name: name.trim(),
        address: address || undefined,
        rosterDay,
      });
      byName.set(key, {
        id,
        name: name.trim(),
        address: address || null,
        rosterDay,
        status: "active",
        floorPlan: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await writeAudit({
        actorId,
        action: "venue.create",
        entityType: "venue",
        entityId: id,
        details: { name, via: "csv" },
      });
      results.push({
        row: line,
        status: "created",
        message: name.trim(),
      });
    } catch (err) {
      results.push({
        row: line,
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
    }
  }
  return tally(results);
}

async function importRooms(
  actorId: string,
  rows: Array<Record<string, string>>
) {
  const results: ImportRowResult[] = [];
  const venueRows = await db.select().from(venues);
  const venueByName = new Map(
    venueRows.map((v) => [v.name.trim().toLowerCase(), v])
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const line = i + 2;
    try {
      const venueName = cell(row, "venue", "venueName");
      const roomId = cell(row, "room", "roomIdentifier", "identifier", "name");

      if (!venueName) throw new Error("venue is required");
      if (!roomId) throw new Error("room is required");

      const venue = venueByName.get(venueName.trim().toLowerCase());
      if (!venue) {
        throw new Error(
          `Unknown venue "${venueName}" — import venues first`
        );
      }

      const existingRoom = await db.query.rooms.findFirst({
        where: (t, { and: a, eq: e }) =>
          a(e(t.venueId, venue.id), e(t.identifier, roomId)),
      });
      if (existingRoom) {
        results.push({
          row: line,
          status: "updated",
          message: `${venue.name} / ${roomId}`,
        });
        continue;
      }

      const id = createId("room");
      await db.insert(rooms).values({
        id,
        venueId: venue.id,
        identifier: roomId,
      });
      await writeAudit({
        actorId,
        action: "room.create",
        entityType: "room",
        entityId: id,
        details: { venueId: venue.id, identifier: roomId, via: "csv" },
      });
      results.push({
        row: line,
        status: "created",
        message: `${venue.name} / ${roomId}`,
      });
    } catch (err) {
      results.push({
        row: line,
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
    }
  }
  return tally(results);
}

async function importAdjudicators(
  actorId: string,
  rows: Array<Record<string, string>>
) {
  const results: ImportRowResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const line = i + 2;
    try {
      const name = cell(row, "name");
      const email = cell(row, "email").toLowerCase();
      const password = cell(row, "password");
      const qualifications = cell(row, "qualifications", "quals") || undefined;

      if (!name || !email) throw new Error("name and email are required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error(`Invalid email "${email}"`);
      }
      if (password && password.length < 8) {
        throw new Error("password must be at least 8 characters");
      }

      let u = await db.query.user.findFirst({
        where: (t, { eq: e }) => e(t.email, email),
      });
      if (!u) {
        const userId = createId("usr");
        await db.insert(user).values({
          id: userId,
          name,
          email,
          emailVerified: true,
          status: "active",
        });
        if (password) {
          await db.insert(account).values({
            id: createId("acc"),
            accountId: userId,
            providerId: "credential",
            userId,
            password: await hashPassword(password),
          });
        }
        u = (await db.query.user.findFirst({
          where: (t, { eq: e }) => e(t.id, userId),
        }))!;
      }

      const existingRole = await db.query.userRoles.findFirst({
        where: (t, { and: a, eq: e }) =>
          a(e(t.userId, u!.id), e(t.role, "adjudicator")),
      });
      if (!existingRole) {
        await db.insert(userRoles).values({
          id: createId("role"),
          userId: u.id,
          role: "adjudicator",
        });
      }

      const existingProfile = await db.query.adjudicatorProfiles.findFirst({
        where: (t, { eq: e }) => e(t.userId, u!.id),
      });
      if (existingProfile) {
        await db
          .update(adjudicatorProfiles)
          .set({
            qualifications: qualifications ?? existingProfile.qualifications,
            active: true,
          })
          .where(eq(adjudicatorProfiles.id, existingProfile.id));
        await db
          .update(user)
          .set({ name, updatedAt: new Date() })
          .where(eq(user.id, u.id));
        await writeAudit({
          actorId,
          action: "adjudicator.update",
          entityType: "adjudicator_profile",
          entityId: existingProfile.id,
          details: { email, via: "csv" },
        });
        results.push({
          row: line,
          status: "updated",
          message: `${name} <${email}>`,
        });
        continue;
      }

      const id = createId("adj");
      await db.insert(adjudicatorProfiles).values({
        id,
        userId: u.id,
        qualifications,
        active: true,
      });
      await writeAudit({
        actorId,
        action: "adjudicator.create",
        entityType: "adjudicator_profile",
        entityId: id,
        details: { email, via: "csv" },
      });
      results.push({
        row: line,
        status: "created",
        message: `${name} <${email}>`,
      });
    } catch (err) {
      results.push({
        row: line,
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
    }
  }
  return tally(results);
}
