"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  byes,
  debates,
  drawVersions,
  institutions,
  roomAvailability,
  rooms,
  rounds,
  teamAvailability,
  teams,
  timeslots,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { generateDraw } from "@/lib/draw";
import { createId } from "@/lib/id";
import { requirePermission } from "@/lib/permissions";
import { formatTeamDisplayName } from "@/lib/teams/display-name";

export async function generateRoundDraw(params: {
  roundId: string;
  scope?: "all" | "venue" | "division";
  scopeId?: string | null;
  seed?: string;
}) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "draws:manage");

  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, params.roundId),
  });
  if (!round) throw new Error("NOT_FOUND");

  if (round.drawStatus === "published") {
    throw new Error(
      "PUBLISHED_DRAW: regenerate requires explicit revision — use revisePublishedDraw"
    );
  }

  const competition = await db.query.competitions.findFirst({
    where: (t, { eq: e }) => e(t.id, round.competitionId),
  });
  if (!competition) throw new Error("NOT_FOUND");

  const allTeams = await db
    .select()
    .from(teams)
    .where(and(eq(teams.competitionId, competition.id), eq(teams.status, "active")));

  const teamAvailRows = await db
    .select()
    .from(teamAvailability)
    .where(eq(teamAvailability.roundId, round.id));
  const unavailableTeams = new Set(
    teamAvailRows.filter((r) => !r.available).map((r) => r.teamId)
  );
  const availableTeams = allTeams.filter((t) => !unavailableTeams.has(t.id));

  const allRooms = await db.select().from(rooms);
  const roomAvailRows = await db
    .select()
    .from(roomAvailability)
    .where(eq(roomAvailability.roundId, round.id));
  const unavailableRooms = new Set(
    roomAvailRows.filter((r) => !r.available).map((r) => r.roomId)
  );
  const availableRooms = allRooms.filter(
    (r) => r.available && !unavailableRooms.has(r.id)
  );

  const slots = await db
    .select()
    .from(timeslots)
    .where(eq(timeslots.roundId, round.id));

  // Prior matches from earlier published rounds
  const priorRounds = await db
    .select()
    .from(rounds)
    .where(
      and(
        eq(rounds.competitionId, competition.id),
        eq(rounds.drawStatus, "published")
      )
    );
  const priorRoundIds = priorRounds
    .filter((r) => r.number < round.number)
    .map((r) => r.id);
  const priorDebates =
    priorRoundIds.length > 0
      ? await db
          .select()
          .from(debates)
          .where(inArray(debates.roundId, priorRoundIds))
      : [];

  const institutionRows = await db.select().from(institutions);
  const institutionMap = new Map(institutionRows.map((i) => [i.id, i]));

  const result = generateDraw({
    teams: availableTeams.map((t) => ({
      id: t.id,
      name: formatTeamDisplayName(
        t,
        t.institutionId ? institutionMap.get(t.institutionId) : null
      ),
      institutionId: t.institutionId,
      divisionId: t.divisionId,
      wins: t.wins,
      losses: t.losses,
      byes: t.byes,
      speakerPoints: t.speakerPoints,
    })),
    rooms: availableRooms.map((r) => ({
      id: r.id,
      venueId: r.venueId,
      identifier: r.identifier,
    })),
    timeslots: slots.map((s) => ({
      id: s.id,
      label: s.label,
      sortOrder: s.sortOrder,
    })),
    priorMatches: priorDebates
      .filter((d) => d.affirmativeTeamId && d.negativeTeamId)
      .map((d) => ({
        teamAId: d.affirmativeTeamId!,
        teamBId: d.negativeTeamId!,
      })),
    config: competition.config,
    seed: params.seed,
    scope: params.scope ?? "all",
    scopeId: params.scopeId,
  });

  // Clear previous draft debates/byes for this round
  await db.delete(debates).where(eq(debates.roundId, round.id));
  await db.delete(byes).where(eq(byes.roundId, round.id));

  const existingVersions = await db
    .select()
    .from(drawVersions)
    .where(eq(drawVersions.roundId, round.id));
  const version = existingVersions.length + 1;
  const versionId = createId("drv");

  await db.insert(drawVersions).values({
    id: versionId,
    roundId: round.id,
    version,
    status: "draft",
    scope: params.scope ?? "all",
    scopeId: params.scopeId ?? null,
    snapshot: result,
    compromises: result.compromises,
    hardViolations: result.hardViolations,
    softWarnings: result.softWarnings,
    seed: result.seed,
    createdBy: ctx.userId,
  });

  for (const d of result.debates) {
    await db.insert(debates).values({
      id: createId("deb"),
      roundId: round.id,
      timeslotId: d.timeslotId,
      venueId: d.venueId,
      roomId: d.roomId,
      divisionId: d.divisionId,
      affirmativeTeamId: d.affirmativeTeamId,
      negativeTeamId: d.negativeTeamId,
      affirmativeTeamName: d.affirmativeTeamName,
      negativeTeamName: d.negativeTeamName,
      isPullUp: d.isPullUp,
      isRematch: d.isRematch,
      isSameInstitution: d.isSameInstitution,
      drawVersionId: versionId,
      status: "scheduled",
    });
  }

  for (const b of result.byes) {
    await db.insert(byes).values({
      id: createId("bye"),
      roundId: round.id,
      teamId: b.teamId,
      reason: b.reason,
      automatic: b.automatic,
      drawVersionId: versionId,
    });
  }

  await db
    .update(rounds)
    .set({ drawStatus: "draft" })
    .where(eq(rounds.id, round.id));

  await writeAudit({
    actorId: ctx.userId,
    action: "draw.generate",
    entityType: "round",
    entityId: round.id,
    details: {
      versionId,
      debates: result.debates.length,
      byes: result.byes.length,
      hardViolations: result.hardViolations,
      softWarnings: result.softWarnings,
    },
  });

  revalidatePath("/admin/draws");
  revalidatePath(`/admin/draws/${round.id}`);
  revalidatePath(`/admin/rounds/${round.id}/draw`);
  revalidatePath(`/admin/rounds/${round.id}/display`);
  return {
    versionId,
    hardViolations: result.hardViolations,
    softWarnings: result.softWarnings,
    compromises: result.compromises,
    debateCount: result.debates.length,
    byeCount: result.byes.length,
  };
}

export async function publishRoundDraw(roundId: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "draws:manage");

  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) throw new Error("NOT_FOUND");

  const versions = await db
    .select()
    .from(drawVersions)
    .where(and(eq(drawVersions.roundId, roundId), eq(drawVersions.status, "draft")));
  const latest = versions.sort((a, b) => b.version - a.version)[0];
  if (!latest) throw new Error("NO_DRAFT");

  if ((latest.hardViolations as string[]).length > 0) {
    throw new Error("HARD_VIOLATIONS: cannot publish draw with unresolved hard constraints");
  }

  // Supersede previous published
  await db
    .update(drawVersions)
    .set({ status: "superseded" })
    .where(and(eq(drawVersions.roundId, roundId), eq(drawVersions.status, "published")));

  await db
    .update(drawVersions)
    .set({
      status: "published",
      publishedAt: new Date(),
      publishedBy: ctx.userId,
    })
    .where(eq(drawVersions.id, latest.id));

  await db
    .update(rounds)
    .set({
      drawStatus: "published",
      publishedAt: new Date(),
      publishedBy: ctx.userId,
    })
    .where(eq(rounds.id, roundId));

  // Update bye counts on teams
  const roundByes = await db.select().from(byes).where(eq(byes.roundId, roundId));
  for (const b of roundByes) {
    const team = await db.query.teams.findFirst({
      where: (t, { eq: e }) => e(t.id, b.teamId),
    });
    if (team) {
      await db
        .update(teams)
        .set({ byes: team.byes + 1, updatedAt: new Date() })
        .where(eq(teams.id, team.id));
    }
  }

  await writeAudit({
    actorId: ctx.userId,
    action: "draw.publish",
    entityType: "round",
    entityId: roundId,
    details: { versionId: latest.id, version: latest.version },
  });

  revalidatePath("/admin/draws");
  revalidatePath(`/admin/draws/${roundId}`);
  revalidatePath(`/admin/rounds/${roundId}/draw`);
  revalidatePath(`/admin/rounds/${roundId}/display`);
  revalidatePath(`/admin/rounds/${roundId}/results`);
  revalidatePath("/public/draw");
  revalidatePath("/coordinator/draw");
}

export async function revisePublishedDraw(roundId: string, seed?: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "draws:manage");

  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) throw new Error("NOT_FOUND");

  // Move published back to allow draft regeneration while keeping version history
  await db
    .update(drawVersions)
    .set({ status: "superseded" })
    .where(and(eq(drawVersions.roundId, roundId), eq(drawVersions.status, "published")));

  await db
    .update(rounds)
    .set({ drawStatus: "draft", publishedAt: null, publishedBy: null })
    .where(eq(rounds.id, roundId));

  await writeAudit({
    actorId: ctx.userId,
    action: "draw.revise",
    entityType: "round",
    entityId: roundId,
  });

  return generateRoundDraw({ roundId, seed });
}

export async function updateDebateAssignment(params: {
  debateId: string;
  roomId?: string | null;
  timeslotId?: string | null;
  affirmativeTeamId?: string | null;
  negativeTeamId?: string | null;
}) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "draws:manage");

  const debate = await db.query.debates.findFirst({
    where: (t, { eq: e }) => e(t.id, params.debateId),
  });
  if (!debate) throw new Error("NOT_FOUND");

  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, debate.roundId),
  });
  if (round?.drawStatus === "published") {
    throw new Error("Cannot edit published draw directly — revise first");
  }

  // Conflict checks
  const timeslotId = params.timeslotId ?? debate.timeslotId;
  if (params.roomId && timeslotId) {
    const conflict = await db.query.debates.findFirst({
      where: (t, { and: a, eq: e, ne }) =>
        a(
          e(t.roundId, debate.roundId),
          e(t.roomId, params.roomId!),
          e(t.timeslotId, timeslotId),
          ne(t.id, debate.id)
        ),
    });
    if (conflict) throw new Error("Room already assigned in this timeslot");
  }

  for (const teamId of [params.affirmativeTeamId, params.negativeTeamId]) {
    if (!teamId || !timeslotId) continue;
    const conflict = await db
      .select()
      .from(debates)
      .where(
        and(
          eq(debates.roundId, debate.roundId),
          eq(debates.timeslotId, timeslotId),
          or(
            eq(debates.affirmativeTeamId, teamId),
            eq(debates.negativeTeamId, teamId)
          )
        )
      );
    if (conflict.some((c) => c.id !== debate.id)) {
      throw new Error("Team already assigned in this timeslot");
    }
  }

  let affName = debate.affirmativeTeamName;
  let negName = debate.negativeTeamName;
  async function displayNameFor(teamId: string) {
    const t = await db.query.teams.findFirst({
      where: (x, { eq: e }) => e(x.id, teamId),
    });
    if (!t) return null;
    const inst = t.institutionId
      ? await db.query.institutions.findFirst({
          where: (x, { eq: e }) => e(x.id, t.institutionId!),
        })
      : null;
    return formatTeamDisplayName(t, inst);
  }
  if (params.affirmativeTeamId) {
    affName = (await displayNameFor(params.affirmativeTeamId)) ?? affName;
  }
  if (params.negativeTeamId) {
    negName = (await displayNameFor(params.negativeTeamId)) ?? negName;
  }

  await db
    .update(debates)
    .set({
      roomId: params.roomId === undefined ? debate.roomId : params.roomId,
      timeslotId: params.timeslotId === undefined ? debate.timeslotId : params.timeslotId,
      affirmativeTeamId:
        params.affirmativeTeamId === undefined
          ? debate.affirmativeTeamId
          : params.affirmativeTeamId,
      negativeTeamId:
        params.negativeTeamId === undefined
          ? debate.negativeTeamId
          : params.negativeTeamId,
      affirmativeTeamName: affName,
      negativeTeamName: negName,
      updatedAt: new Date(),
    })
    .where(eq(debates.id, debate.id));

  await writeAudit({
    actorId: ctx.userId,
    action: "debate.update",
    entityType: "debate",
    entityId: debate.id,
    details: params,
  });

  revalidatePath(`/admin/draws/${debate.roundId}`);
}
