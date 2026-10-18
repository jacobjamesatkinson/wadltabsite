"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { byes, debates, drawVersions, rounds, type DrawOptions } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { generateDraw, type DrawReport } from "@/lib/draw";
import { loadDrawInput } from "@/lib/draw/load";
import { createId } from "@/lib/id";
import { requirePermission } from "@/lib/permissions";
import { recomputeTeamStats } from "@/lib/results/recompute";
import { formatTeamDisplayName } from "@/lib/teams/display-name";

function revalidateRound(roundId: string) {
  for (const p of [
    `/admin/rounds/${roundId}`,
    `/admin/rounds/${roundId}/draw`,
    `/admin/rounds/${roundId}/matchups`,
    `/admin/rounds/${roundId}/adjudicators`,
    `/admin/rounds/${roundId}/display`,
    `/admin/rounds/${roundId}/results`,
    "/admin",
    "/public/draw",
    "/coordinator/draw",
    "/ha/draw",
    "/adjudicator",
  ]) {
    revalidatePath(p);
  }
}

async function requireDrawManager() {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  requirePermission(ctx, "draws:manage");
  return ctx;
}

async function requireRound(roundId: string) {
  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) throw new Error("NOT_FOUND");
  return round;
}

export type CreateDrawResult =
  | { ok: true; versionId: string; report: DrawReport }
  | { ok: false; report: DrawReport };

/**
 * Generate and save a draft draw. Refuses (without saving) when the report
 * contains fatal issues so the admin can fix the data and try again.
 */
export async function createDraw(params: {
  roundId: string;
  options?: Partial<DrawOptions>;
  seed?: string;
  /** Save even if there are fatal issues such as a room shortfall. */
  force?: boolean;
}): Promise<CreateDrawResult> {
  const ctx = await requireDrawManager();
  const round = await requireRound(params.roundId);
  if (round.drawStatus !== "none") {
    throw new Error("A draw already exists for this round — delete it before creating another");
  }

  const input = await loadDrawInput(round.id);
  const result = generateDraw({ ...input, options: params.options, seed: params.seed });

  const blocking = result.report.issues.filter(
    (i) =>
      i.severity === "fatal" &&
      // Room shortfalls can be forced; the admin can fix rooms in the matchups page.
      !(params.force && (i.code === "room_shortfall" || i.code === "no_rooms_for_venue"))
  );
  if (blocking.length > 0) {
    return { ok: false, report: result.report };
  }

  const versionId = createId("drv");
  await db.insert(drawVersions).values({
    id: versionId,
    roundId: round.id,
    version: 1,
    status: "draft",
    scope: "all",
    scopeId: null,
    drawType: result.options.type,
    options: result.options,
    snapshot: { report: result.report, byes: result.byes, debates: result.debates },
    compromises: [],
    hardViolations: result.report.issues.filter((i) => i.severity === "fatal").map((i) => i.message),
    softWarnings: result.report.issues.filter((i) => i.severity === "warning").map((i) => i.message),
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
      affirmativeTeamId: d.affirmativeTeamId || null,
      negativeTeamId: d.negativeTeamId || null,
      affirmativeTeamName: d.affirmativeTeamName || null,
      negativeTeamName: d.negativeTeamName || null,
      bracket: d.bracket,
      roomRank: d.roomRank,
      flags: d.flags,
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

  await db.update(rounds).set({ drawStatus: "draft" }).where(eq(rounds.id, round.id));

  await writeAudit({
    actorId: ctx.userId,
    action: "draw.create",
    entityType: "round",
    entityId: round.id,
    details: {
      versionId,
      type: result.options.type,
      seed: result.seed,
      stats: result.report.stats,
      warnings: result.report.issues.filter((i) => i.severity !== "info").length,
    },
  });

  revalidateRound(round.id);
  return { ok: true, versionId, report: result.report };
}

/** Delete the round's draw entirely (debates, byes, allocations, ballots, versions). */
export async function deleteDraw(roundId: string) {
  const ctx = await requireDrawManager();
  const round = await requireRound(roundId);

  const roundDebates = await db
    .select({ id: debates.id })
    .from(debates)
    .where(eq(debates.roundId, roundId));
  await db.delete(debates).where(eq(debates.roundId, roundId));
  await db.delete(byes).where(eq(byes.roundId, roundId));
  await db.delete(drawVersions).where(eq(drawVersions.roundId, roundId));
  await db
    .update(rounds)
    .set({ drawStatus: "none", publishedAt: null, publishedBy: null })
    .where(eq(rounds.id, roundId));

  await recomputeTeamStats(round.competitionId);

  await writeAudit({
    actorId: ctx.userId,
    action: "draw.delete",
    entityType: "round",
    entityId: roundId,
    details: { debates: roundDebates.length, wasPublished: round.drawStatus === "published" },
  });
  revalidateRound(roundId);
}

/** Release (publish) the draft draw to teams and adjudicators. */
export async function releaseDraw(roundId: string) {
  const ctx = await requireDrawManager();
  const round = await requireRound(roundId);
  if (round.drawStatus !== "draft") throw new Error("Only a draft draw can be released");

  const missingTeams = (
    await db.select().from(debates).where(eq(debates.roundId, roundId))
  ).filter((d) => !d.affirmativeTeamId || !d.negativeTeamId);
  if (missingTeams.length > 0) {
    throw new Error(
      `${missingTeams.length} room${missingTeams.length === 1 ? " is" : "s are"} missing a team — fix matchups before releasing`
    );
  }

  await db
    .update(drawVersions)
    .set({ status: "published", publishedAt: new Date(), publishedBy: ctx.userId })
    .where(and(eq(drawVersions.roundId, roundId), eq(drawVersions.status, "draft")));
  await db
    .update(rounds)
    .set({ drawStatus: "published", publishedAt: new Date(), publishedBy: ctx.userId })
    .where(eq(rounds.id, roundId));

  await recomputeTeamStats(round.competitionId);

  await writeAudit({
    actorId: ctx.userId,
    action: "draw.release",
    entityType: "round",
    entityId: roundId,
  });
  revalidateRound(roundId);
}

/** Pull a released draw back to draft. Keeps all debates and allocations. */
export async function unreleaseDraw(roundId: string) {
  const ctx = await requireDrawManager();
  const round = await requireRound(roundId);
  if (round.drawStatus !== "published") throw new Error("Draw is not released");

  await db
    .update(drawVersions)
    .set({ status: "draft", publishedAt: null, publishedBy: null })
    .where(and(eq(drawVersions.roundId, roundId), eq(drawVersions.status, "published")));
  await db
    .update(rounds)
    .set({ drawStatus: "draft", publishedAt: null, publishedBy: null })
    .where(eq(rounds.id, roundId));

  await recomputeTeamStats(round.competitionId);

  await writeAudit({
    actorId: ctx.userId,
    action: "draw.unrelease",
    entityType: "round",
    entityId: roundId,
  });
  revalidateRound(roundId);
}

// ---------------------------------------------------------------------------
// Matchup editing
// ---------------------------------------------------------------------------

async function requireDebate(debateId: string) {
  const debate = await db.query.debates.findFirst({
    where: (t, { eq: e }) => e(t.id, debateId),
  });
  if (!debate) throw new Error("NOT_FOUND");
  return debate;
}

async function teamDisplayName(teamId: string) {
  const t = await db.query.teams.findFirst({ where: (x, { eq: e }) => e(x.id, teamId) });
  if (!t) return null;
  const inst = t.institutionId
    ? await db.query.institutions.findFirst({
        where: (x, { eq: e }) => e(x.id, t.institutionId!),
      })
    : null;
  return { team: t, name: formatTeamDisplayName(t, inst) };
}

function manualFlags(flags: string[] | null | undefined) {
  const next = new Set((flags ?? []) as string[]);
  next.add("manual");
  return [...next] as NonNullable<typeof debates.$inferInsert.flags>;
}

export async function swapSides(debateId: string) {
  const ctx = await requireDrawManager();
  const debate = await requireDebate(debateId);
  await db
    .update(debates)
    .set({
      affirmativeTeamId: debate.negativeTeamId,
      negativeTeamId: debate.affirmativeTeamId,
      affirmativeTeamName: debate.negativeTeamName,
      negativeTeamName: debate.affirmativeTeamName,
      flags: manualFlags(debate.flags),
      updatedAt: new Date(),
    })
    .where(eq(debates.id, debateId));
  await writeAudit({
    actorId: ctx.userId,
    action: "debate.swap_sides",
    entityType: "debate",
    entityId: debateId,
  });
  revalidateRound(debate.roundId);
}

/**
 * Put a team into a side of a debate. The team must share the debate's venue,
 * timeslot and division. If the team already sits elsewhere in the round, it
 * is removed from there (and from any bye) first.
 */
export async function placeTeam(params: {
  debateId: string;
  side: "affirmative" | "negative";
  teamId: string;
}) {
  const ctx = await requireDrawManager();
  const debate = await requireDebate(params.debateId);
  const found = await teamDisplayName(params.teamId);
  if (!found) throw new Error("Team not found");
  const { team, name } = found;

  const problems: string[] = [];
  if (debate.venueId && team.venueId !== debate.venueId) problems.push("venue");
  if (debate.timeslotId && team.timeslotId !== debate.timeslotId) problems.push("timeslot");
  if (debate.divisionId && team.divisionId !== debate.divisionId) problems.push("division");
  if (problems.length > 0) {
    throw new Error(`${name} is in a different ${problems.join(", ")} to this room`);
  }

  // Vacate wherever this team currently is in the round.
  const elsewhere = await db
    .select()
    .from(debates)
    .where(
      and(
        eq(debates.roundId, debate.roundId),
        ne(debates.id, debate.id),
        or(eq(debates.affirmativeTeamId, team.id), eq(debates.negativeTeamId, team.id))
      )
    );
  for (const other of elsewhere) {
    const isAff = other.affirmativeTeamId === team.id;
    await db
      .update(debates)
      .set({
        affirmativeTeamId: isAff ? null : other.affirmativeTeamId,
        affirmativeTeamName: isAff ? null : other.affirmativeTeamName,
        negativeTeamId: isAff ? other.negativeTeamId : null,
        negativeTeamName: isAff ? other.negativeTeamName : null,
        flags: manualFlags(other.flags),
        updatedAt: new Date(),
      })
      .where(eq(debates.id, other.id));
  }
  await db.delete(byes).where(and(eq(byes.roundId, debate.roundId), eq(byes.teamId, team.id)));

  // If the team is already on the other side of this debate, this is a swap.
  const otherSide = params.side === "affirmative" ? "negative" : "affirmative";
  const otherId =
    otherSide === "affirmative" ? debate.affirmativeTeamId : debate.negativeTeamId;
  const otherName =
    otherSide === "affirmative" ? debate.affirmativeTeamName : debate.negativeTeamName;
  const displaced =
    params.side === "affirmative" ? debate.affirmativeTeamId : debate.negativeTeamId;
  const displacedName =
    params.side === "affirmative" ? debate.affirmativeTeamName : debate.negativeTeamName;

  const movingAcross = otherId === team.id;
  const next = {
    affirmativeTeamId:
      params.side === "affirmative" ? team.id : movingAcross ? displaced : otherId,
    affirmativeTeamName:
      params.side === "affirmative" ? name : movingAcross ? displacedName : otherName,
    negativeTeamId:
      params.side === "negative" ? team.id : movingAcross ? displaced : otherId,
    negativeTeamName:
      params.side === "negative" ? name : movingAcross ? displacedName : otherName,
  };

  await db
    .update(debates)
    .set({ ...next, flags: manualFlags(debate.flags), updatedAt: new Date() })
    .where(eq(debates.id, debate.id));

  await writeAudit({
    actorId: ctx.userId,
    action: "debate.place_team",
    entityType: "debate",
    entityId: debate.id,
    details: { teamId: team.id, side: params.side, displacedTeamId: movingAcross ? null : displaced },
  });
  revalidateRound(debate.roundId);
  return { displacedTeamId: movingAcross ? null : displaced };
}

/** Remove a team from one side of a debate (it returns to the unallocated tray). */
export async function unplaceTeam(params: {
  debateId: string;
  side: "affirmative" | "negative";
}) {
  const ctx = await requireDrawManager();
  const debate = await requireDebate(params.debateId);
  await db
    .update(debates)
    .set(
      params.side === "affirmative"
        ? { affirmativeTeamId: null, affirmativeTeamName: null, flags: manualFlags(debate.flags), updatedAt: new Date() }
        : { negativeTeamId: null, negativeTeamName: null, flags: manualFlags(debate.flags), updatedAt: new Date() }
    )
    .where(eq(debates.id, debate.id));
  await writeAudit({
    actorId: ctx.userId,
    action: "debate.unplace_team",
    entityType: "debate",
    entityId: debate.id,
    details: params,
  });
  revalidateRound(debate.roundId);
}

/** Add an empty room to a venue/timeslot/division group. */
export async function addDebate(params: {
  roundId: string;
  venueId: string;
  timeslotId: string;
  divisionId: string;
}) {
  const ctx = await requireDrawManager();
  const round = await requireRound(params.roundId);
  if (round.drawStatus === "none") throw new Error("Create a draw first");
  const version = await db.query.drawVersions.findFirst({
    where: (t, { eq: e }) => e(t.roundId, round.id),
  });
  const siblings = await db
    .select({ roomRank: debates.roomRank })
    .from(debates)
    .where(
      and(
        eq(debates.roundId, round.id),
        eq(debates.venueId, params.venueId),
        eq(debates.timeslotId, params.timeslotId)
      )
    );
  const id = createId("deb");
  await db.insert(debates).values({
    id,
    roundId: round.id,
    venueId: params.venueId,
    timeslotId: params.timeslotId,
    divisionId: params.divisionId,
    roomRank: Math.max(0, ...siblings.map((s) => s.roomRank ?? 0)) + 1,
    flags: ["manual"],
    drawVersionId: version?.id ?? null,
    status: "scheduled",
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "debate.add",
    entityType: "debate",
    entityId: id,
    details: params,
  });
  revalidateRound(round.id);
  return { id };
}

/** Remove a room. Any teams in it return to the unallocated tray. */
export async function removeDebate(debateId: string) {
  const ctx = await requireDrawManager();
  const debate = await requireDebate(debateId);
  await db.delete(debates).where(eq(debates.id, debateId));
  await writeAudit({
    actorId: ctx.userId,
    action: "debate.remove",
    entityType: "debate",
    entityId: debateId,
    details: { affirmativeTeamId: debate.affirmativeTeamId, negativeTeamId: debate.negativeTeamId },
  });
  revalidateRound(debate.roundId);
}

/** Set (or clear) the physical room. Room must belong to the debate's venue. */
export async function setDebateRoom(params: { debateId: string; roomId: string | null }) {
  const ctx = await requireDrawManager();
  const debate = await requireDebate(params.debateId);

  if (params.roomId) {
    const room = await db.query.rooms.findFirst({
      where: (t, { eq: e }) => e(t.id, params.roomId!),
    });
    if (!room) throw new Error("Room not found");
    if (debate.venueId && room.venueId !== debate.venueId) {
      throw new Error("That room is at a different venue");
    }
    if (debate.timeslotId) {
      const clash = await db.query.debates.findFirst({
        where: (t, { and: a, eq: e, ne: n }) =>
          a(
            e(t.roundId, debate.roundId),
            e(t.roomId, params.roomId!),
            e(t.timeslotId, debate.timeslotId!),
            n(t.id, debate.id)
          ),
      });
      if (clash) {
        throw new Error(
          `Room ${room.identifier} already hosts ${clash.affirmativeTeamName ?? "?"} v ${clash.negativeTeamName ?? "?"} at this time`
        );
      }
    }
  }

  await db
    .update(debates)
    .set({ roomId: params.roomId, updatedAt: new Date() })
    .where(eq(debates.id, debate.id));
  await writeAudit({
    actorId: ctx.userId,
    action: "debate.set_room",
    entityType: "debate",
    entityId: debate.id,
    details: params,
  });
  revalidateRound(debate.roundId);
}

/** Give an unallocated team a bye for the round. */
export async function giveBye(params: { roundId: string; teamId: string }) {
  const ctx = await requireDrawManager();
  const round = await requireRound(params.roundId);
  const inDebate = await db.query.debates.findFirst({
    where: (t, { and: a, eq: e, or: o }) =>
      a(
        e(t.roundId, round.id),
        o(e(t.affirmativeTeamId, params.teamId), e(t.negativeTeamId, params.teamId))
      ),
  });
  if (inDebate) throw new Error("Team is already in a room — remove it first");
  const existing = await db.query.byes.findFirst({
    where: (t, { and: a, eq: e }) => a(e(t.roundId, round.id), e(t.teamId, params.teamId)),
  });
  if (existing) return;
  const version = await db.query.drawVersions.findFirst({
    where: (t, { eq: e }) => e(t.roundId, round.id),
  });
  await db.insert(byes).values({
    id: createId("bye"),
    roundId: round.id,
    teamId: params.teamId,
    reason: "Bye given manually",
    automatic: false,
    authorisedBy: ctx.userId,
    drawVersionId: version?.id ?? null,
  });
  await recomputeTeamStats(round.competitionId);
  await writeAudit({
    actorId: ctx.userId,
    action: "bye.give",
    entityType: "round",
    entityId: round.id,
    details: params,
  });
  revalidateRound(round.id);
}

export async function removeBye(byeId: string) {
  const ctx = await requireDrawManager();
  const bye = await db.query.byes.findFirst({ where: (t, { eq: e }) => e(t.id, byeId) });
  if (!bye) throw new Error("NOT_FOUND");
  const round = await requireRound(bye.roundId);
  await db.delete(byes).where(eq(byes.id, byeId));
  await recomputeTeamStats(round.competitionId);
  await writeAudit({
    actorId: ctx.userId,
    action: "bye.remove",
    entityType: "round",
    entityId: bye.roundId,
    details: { teamId: bye.teamId },
  });
  revalidateRound(bye.roundId);
}