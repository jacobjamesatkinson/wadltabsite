"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  ballots,
  debates,
  normalizeCompetitionConfig,
  speakerScores,
  speakers,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { toHundredths, validateBallot } from "@/lib/ballots/validate";
import { createId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";
import { recomputeTeamStats } from "@/lib/results/recompute";

const speechSchema = z.object({
  position: z.number().int().min(1),
  speakerId: z.string().nullable(),
  score: z.number().nullable(),
  ghost: z.boolean().default(false),
});

const submitSchema = z.object({
  debateId: z.string(),
  affirmative: z.array(speechSchema),
  negative: z.array(speechSchema),
  winnerTeamId: z.string().nullable().optional(),
  feedback: z.string().optional(),
  /** Discard this earlier version when saving (editing an unconfirmed ballot). */
  replaceBallotId: z.string().nullable().optional(),
  /** Confirm immediately — only honoured for users who may confirm ballots. */
  confirm: z.boolean().optional(),
});

export type SubmitBallotInput = z.infer<typeof submitSchema>;

function revalidateResults(roundId: string) {
  for (const p of [
    `/admin/rounds/${roundId}/results`,
    "/admin/results",
    "/adjudicator",
    "/adjudicator/ballots",
    "/ha/ballots",
    "/coordinator/results",
    "/admin",
  ]) {
    revalidatePath(p);
  }
}

async function loadDebateContext(debateId: string) {
  const debate = await db.query.debates.findFirst({ where: (t, { eq: e }) => e(t.id, debateId) });
  if (!debate) throw new Error("NOT_FOUND");
  if (!debate.affirmativeTeamId || !debate.negativeTeamId) {
    throw new Error("This debate is missing a team — fix the matchups first");
  }
  const round = await db.query.rounds.findFirst({ where: (t, { eq: e }) => e(t.id, debate.roundId) });
  if (!round) throw new Error("NOT_FOUND");
  const competition = await db.query.competitions.findFirst({
    where: (t, { eq: e }) => e(t.id, round.competitionId),
  });
  if (!competition) throw new Error("NOT_FOUND");
  return { debate, round, config: normalizeCompetitionConfig(competition.config) };
}

/** Same gate as ballot entry: reviewers for any debate; adjudicators only when allocated. */
async function assertCanEnterBallot(
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>,
  debateId: string
) {
  const canReview = hasPermission(ctx, "ballots:review") || hasPermission(ctx, "results:manage");
  if (!hasPermission(ctx, "ballots:submit") && !canReview) throw new Error("FORBIDDEN");
  if (canReview) return { canReview: true as const };

  const profile = await db.query.adjudicatorProfiles.findFirst({
    where: (t, { eq: e }) => e(t.userId, ctx.userId),
  });
  const assignment = profile
    ? await db.query.adjudicatorAssignments.findFirst({
        where: (t, { and: a, eq: e }) => a(e(t.debateId, debateId), e(t.adjudicatorId, profile.id)),
      })
    : null;
  if (!assignment) throw new Error("You are not allocated to this debate");
  return { canReview: false as const };
}

/**
 * Enter a ballot (Tabbycat "ballot submission"). Creates a new version for the
 * debate with per-speaker scores. Adjudicators may only enter ballots for
 * debates they are allocated to; admins/HA can enter for any debate and may
 * confirm in the same step.
 */
export async function submitBallot(input: SubmitBallotInput) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");

  const data = submitSchema.parse(input);
  const { debate, round, config } = await loadDebateContext(data.debateId);
  const { canReview } = await assertCanEnterBallot(ctx, debate.id);
  // Ballots from reviewers never need review; adjudicator ballots wait for confirmation.
  const needsReview = !canReview;

  const validation = validateBallot(
    {
      affirmative: { teamId: debate.affirmativeTeamId!, speeches: data.affirmative },
      negative: { teamId: debate.negativeTeamId!, speeches: data.negative },
      winnerTeamId: data.winnerTeamId ?? null,
    },
    config.scores
  );
  if (!validation.ok) {
    const first = validation.errors[0] ?? Object.values(validation.fieldErrors)[0];
    throw new Error(first ?? "Ballot is invalid");
  }

  const existing = await db.select().from(ballots).where(eq(ballots.debateId, debate.id));
  if (existing.some((b) => b.status === "accepted" && !b.discarded) && !canReview) {
    throw new Error("A confirmed ballot already exists for this debate");
  }
  const version = Math.max(0, ...existing.map((b) => b.version)) + 1;

  if (data.replaceBallotId) {
    await db
      .update(ballots)
      .set({ discarded: true, status: "disputed", updatedAt: new Date() })
      .where(and(eq(ballots.id, data.replaceBallotId), eq(ballots.debateId, debate.id)));
  }

  const profile = await db.query.adjudicatorProfiles.findFirst({
    where: (t, { eq: e }) => e(t.userId, ctx.userId),
  });

  const id = createId("bal");
  await db.insert(ballots).values({
    id,
    debateId: debate.id,
    adjudicatorId: profile?.id ?? null,
    submittedByUserId: ctx.userId,
    status: "submitted",
    version,
    winnerTeamId: validation.winnerTeamId,
    affirmativePoints: Math.round(validation.affTotal),
    negativePoints: Math.round(validation.negTotal),
    margin: Math.round(validation.margin),
    feedback: data.feedback,
    needsReview,
    rawPayload: { affirmative: data.affirmative, negative: data.negative, winnerTeamId: data.winnerTeamId ?? null },
  });

  const rows = [
    ...data.affirmative.map((s) => ({ ...s, teamId: debate.affirmativeTeamId! })),
    ...data.negative.map((s) => ({ ...s, teamId: debate.negativeTeamId! })),
  ];
  for (const s of rows) {
    await db.insert(speakerScores).values({
      id: createId("spk"),
      ballotId: id,
      debateId: debate.id,
      teamId: s.teamId,
      speakerId: s.speakerId,
      position: s.position,
      scoreHundredths: toHundredths(s.score ?? 0),
      ghost: s.ghost,
    });
  }

  await writeAudit({
    actorId: ctx.userId,
    action: "ballot.submit",
    entityType: "ballot",
    entityId: id,
    details: { debateId: debate.id, version, replaced: data.replaceBallotId ?? null, needsReview },
  });

  if (data.confirm && canReview) {
    await confirmBallot(id);
  }

  revalidateResults(round.id);
  return { id, version, needsReview, confirmed: Boolean(data.confirm && canReview) };
}

/** Confirm a ballot: it becomes the debate's result; other versions are discarded. */
export async function confirmBallot(ballotId: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  if (!hasPermission(ctx, "ballots:review") && !hasPermission(ctx, "results:manage")) {
    throw new Error("FORBIDDEN");
  }
  const ballot = await db.query.ballots.findFirst({ where: (t, { eq: e }) => e(t.id, ballotId) });
  if (!ballot) throw new Error("NOT_FOUND");
  if (ballot.discarded) throw new Error("This ballot was discarded");
  const { debate, round } = await loadDebateContext(ballot.debateId);

  await db
    .update(ballots)
    .set({ discarded: true, updatedAt: new Date() })
    .where(and(eq(ballots.debateId, debate.id), ne(ballots.id, ballotId), eq(ballots.discarded, false)));

  await db
    .update(ballots)
    .set({
      status: "accepted",
      acceptedAt: new Date(),
      acceptedBy: ctx.userId,
      confirmedBy: ctx.userId,
      needsReview: false,
      updatedAt: new Date(),
    })
    .where(eq(ballots.id, ballotId));

  await db.update(debates).set({ status: "completed", updatedAt: new Date() }).where(eq(debates.id, debate.id));
  await recomputeTeamStats(round.competitionId);

  const later = await db.query.rounds.findFirst({
    where: (t, { and: a, eq: e, gt }) =>
      a(e(t.competitionId, round.competitionId), gt(t.number, round.number), e(t.drawStatus, "published")),
  });
  const laterDrawWarning = later
    ? `${later.name} is already released — its power pairing used earlier standings.`
    : null;

  await writeAudit({
    actorId: ctx.userId,
    action: "ballot.confirm",
    entityType: "ballot",
    entityId: ballotId,
    details: { debateId: debate.id, laterDrawWarning },
  });
  revalidateResults(round.id);
  return { laterDrawWarning };
}

/** Discard a ballot version. If it was the confirmed result, the debate reopens. */
export async function discardBallot(ballotId: string, notes?: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  if (!hasPermission(ctx, "ballots:review") && !hasPermission(ctx, "results:manage")) {
    throw new Error("FORBIDDEN");
  }
  const ballot = await db.query.ballots.findFirst({ where: (t, { eq: e }) => e(t.id, ballotId) });
  if (!ballot) throw new Error("NOT_FOUND");
  const { debate, round } = await loadDebateContext(ballot.debateId);

  const wasConfirmed = ballot.status === "accepted" && !ballot.discarded;
  await db
    .update(ballots)
    .set({ discarded: true, status: "disputed", reviewNotes: notes ?? ballot.reviewNotes, updatedAt: new Date() })
    .where(eq(ballots.id, ballotId));
  if (wasConfirmed) {
    await db.update(debates).set({ status: "scheduled", updatedAt: new Date() }).where(eq(debates.id, debate.id));
    await recomputeTeamStats(round.competitionId);
  }

  await writeAudit({
    actorId: ctx.userId,
    action: "ballot.discard",
    entityType: "ballot",
    entityId: ballotId,
    details: { debateId: debate.id, wasConfirmed, notes },
  });
  revalidateResults(round.id);
}

/**
 * Create a speaker on a team while entering a ballot. Allowed for anyone who
 * may submit a ballot for this debate (allocated adjudicator or reviewer).
 */
export async function addSpeakerFromBallot(input: {
  debateId: string;
  teamId: string;
  name: string;
}) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");

  const { debate, round } = await loadDebateContext(input.debateId);
  await assertCanEnterBallot(ctx, debate.id);

  if (input.teamId !== debate.affirmativeTeamId && input.teamId !== debate.negativeTeamId) {
    throw new Error("That team is not in this debate");
  }

  const team = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.id, input.teamId),
  });
  if (!team) throw new Error("NOT_FOUND");

  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("Speaker name required");

  const id = createId("spk");
  await db.insert(speakers).values({ id, teamId: team.id, name: trimmed });
  await writeAudit({
    actorId: ctx.userId,
    action: "speaker.create.ballot",
    entityType: "speaker",
    entityId: id,
    details: { teamId: team.id, debateId: debate.id, name: trimmed },
  });
  revalidatePath(`/admin/teams/${team.id}`);
  revalidatePath("/admin/teams");
  revalidatePath(`/admin/rounds/${round.id}/results`);
  revalidatePath(`/adjudicator/ballots/${debate.id}`);
  return { id, name: trimmed };
}
