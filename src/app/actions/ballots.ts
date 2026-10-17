"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  ballots,
  debates,
  teams,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { createId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";

const submitSchema = z.object({
  debateId: z.string(),
  winnerTeamId: z.string(),
  affirmativePoints: z.number().int().min(0),
  negativePoints: z.number().int().min(0),
  feedback: z.string().optional(),
});

export async function submitBallot(input: z.infer<typeof submitSchema>) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  if (!hasPermission(ctx, "ballots:submit") && !hasPermission(ctx, "ballots:review")) {
    throw new Error("FORBIDDEN");
  }

  const data = submitSchema.parse(input);
  const debate = await db.query.debates.findFirst({
    where: (t, { eq: e }) => e(t.id, data.debateId),
  });
  if (!debate) throw new Error("NOT_FOUND");

  const profile = await db.query.adjudicatorProfiles.findFirst({
    where: (t, { eq: e }) => e(t.userId, ctx.userId),
  });

  let needsReview = false;
  if (profile) {
    const assignment = await db.query.adjudicatorAssignments.findFirst({
      where: (t, { and: a, eq: e }) =>
        a(e(t.debateId, data.debateId), e(t.adjudicatorId, profile.id)),
    });
    if (!assignment) needsReview = true;
  } else {
    needsReview = true;
  }

  const margin = Math.abs(data.affirmativePoints - data.negativePoints);
  const id = createId("bal");
  await db.insert(ballots).values({
    id,
    debateId: data.debateId,
    adjudicatorId: profile?.id ?? null,
    submittedByUserId: ctx.userId,
    status: "submitted",
    winnerTeamId: data.winnerTeamId,
    affirmativePoints: data.affirmativePoints,
    negativePoints: data.negativePoints,
    margin,
    feedback: data.feedback,
    needsReview,
  });

  await writeAudit({
    actorId: ctx.userId,
    action: "ballot.submit",
    entityType: "ballot",
    entityId: id,
    details: { ...data, needsReview },
  });

  revalidatePath("/adjudicator/ballots");
  revalidatePath("/admin/results");
  revalidatePath(`/admin/rounds/${debate.roundId}/results`);
  revalidatePath("/ha/ballots");
  return { id, needsReview };
}

export async function acceptBallot(ballotId: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  if (!hasPermission(ctx, "ballots:review") && !hasPermission(ctx, "results:manage")) {
    throw new Error("FORBIDDEN");
  }

  const ballot = await db.query.ballots.findFirst({
    where: (t, { eq: e }) => e(t.id, ballotId),
  });
  if (!ballot) throw new Error("NOT_FOUND");
  if (!ballot.winnerTeamId || !ballot.debateId) throw new Error("INVALID_BALLOT");

  const debate = await db.query.debates.findFirst({
    where: (t, { eq: e }) => e(t.id, ballot.debateId),
  });
  if (!debate?.affirmativeTeamId || !debate.negativeTeamId) {
    throw new Error("INVALID_DEBATE");
  }

  // Check later published rounds — alert rather than silent mutate history
  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, debate.roundId),
  });
  let laterDrawWarning: string | null = null;
  if (round) {
    const later = await db.query.rounds.findFirst({
      where: (t, { and: a, eq: e, gt }) =>
        a(
          e(t.competitionId, round.competitionId),
          gt(t.number, round.number),
          e(t.drawStatus, "published")
        ),
    });
    if (later) {
      laterDrawWarning = `Accepted result may affect later published round ${later.name}. Review power pairing inputs.`;
    }
  }

  await db
    .update(ballots)
    .set({
      status: "accepted",
      acceptedAt: new Date(),
      acceptedBy: ctx.userId,
      needsReview: false,
      updatedAt: new Date(),
    })
    .where(eq(ballots.id, ballotId));

  const aff = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.id, debate.affirmativeTeamId!),
  });
  const neg = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.id, debate.negativeTeamId!),
  });
  if (aff && neg) {
    const affWin = ballot.winnerTeamId === aff.id;
    await db
      .update(teams)
      .set({
        wins: aff.wins + (affWin ? 1 : 0),
        losses: aff.losses + (affWin ? 0 : 1),
        speakerPoints: aff.speakerPoints + (ballot.affirmativePoints ?? 0),
        updatedAt: new Date(),
      })
      .where(eq(teams.id, aff.id));
    await db
      .update(teams)
      .set({
        wins: neg.wins + (affWin ? 0 : 1),
        losses: neg.losses + (affWin ? 1 : 0),
        speakerPoints: neg.speakerPoints + (ballot.negativePoints ?? 0),
        updatedAt: new Date(),
      })
      .where(eq(teams.id, neg.id));
  }

  await db
    .update(debates)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(debates.id, debate.id));

  await writeAudit({
    actorId: ctx.userId,
    action: "ballot.accept",
    entityType: "ballot",
    entityId: ballotId,
    details: { laterDrawWarning },
  });

  revalidatePath("/admin/results");
  revalidatePath("/ha/ballots");
  revalidatePath("/coordinator/results");
  return { laterDrawWarning };
}

export async function disputeBallot(ballotId: string, notes: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  if (!hasPermission(ctx, "ballots:review") && !hasPermission(ctx, "results:manage")) {
    throw new Error("FORBIDDEN");
  }
  await db
    .update(ballots)
    .set({
      status: "disputed",
      reviewNotes: notes,
      needsReview: true,
      updatedAt: new Date(),
    })
    .where(eq(ballots.id, ballotId));
  await writeAudit({
    actorId: ctx.userId,
    action: "ballot.dispute",
    entityType: "ballot",
    entityId: ballotId,
    details: { notes },
  });
  revalidatePath("/admin/results");
  revalidatePath("/ha/ballots");
}
