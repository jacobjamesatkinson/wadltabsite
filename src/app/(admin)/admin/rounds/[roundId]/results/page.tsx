import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  adjudicatorAssignments,
  adjudicatorProfiles,
  ballots,
  debates,
  rooms,
  user,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { RoundStepNav } from "../round-step-nav";
import { AddBallotDialog } from "./add-ballot-dialog";
import { ResultsDataTable, type ResultsRow } from "./results-table";

export default async function RoundResultsPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  const round = await db.query.rounds.findFirst({
    where: (t, { eq: e }) => e(t.id, roundId),
  });
  if (!round) notFound();

  const [debateRows, roomRows, ballotRows, assignmentRows, adjProfiles, users] =
    await Promise.all([
      db.select().from(debates).where(eq(debates.roundId, roundId)),
      db.select().from(rooms),
      db.select().from(ballots),
      db.select().from(adjudicatorAssignments),
      db.select().from(adjudicatorProfiles),
      db.select({ id: user.id, name: user.name }).from(user),
    ]);

  const roomMap = new Map(roomRows.map((r) => [r.id, r.identifier]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const adjName = new Map(
    adjProfiles.map((a) => [a.id, userName.get(a.userId) ?? a.id])
  );

  const ballotsByDebate = new Map<string, (typeof ballotRows)[number][]>();
  for (const b of ballotRows) {
    const list = ballotsByDebate.get(b.debateId) ?? [];
    list.push(b);
    ballotsByDebate.set(b.debateId, list);
  }

  const assignmentsByDebate = new Map<string, string[]>();
  for (const a of assignmentRows) {
    const list = assignmentsByDebate.get(a.debateId) ?? [];
    list.push(adjName.get(a.adjudicatorId) ?? a.adjudicatorId);
    assignmentsByDebate.set(a.debateId, list);
  }

  const rows: ResultsRow[] = debateRows.map((d) => {
    const debateBallots = (ballotsByDebate.get(d.id) ?? []).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    const latest = debateBallots[0];
    const enteredBy = latest
      ? latest.adjudicatorId
        ? adjName.get(latest.adjudicatorId) ??
          userName.get(latest.submittedByUserId ?? "") ??
          "Adjudicator"
        : userName.get(latest.submittedByUserId ?? "") ?? "Admin"
      : "—";
    const enteredAt = latest
      ? latest.createdAt.toLocaleTimeString("en-AU", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    let winnerSide: ResultsRow["winnerSide"] = "none";
    if (latest?.winnerTeamId) {
      if (latest.winnerTeamId === d.affirmativeTeamId) winnerSide = "aff";
      else if (latest.winnerTeamId === d.negativeTeamId) winnerSide = "neg";
    }

    return {
      id: d.id,
      status: latest?.status ?? "pending",
      ballotLabel: latest
        ? latest.status === "accepted"
          ? `Accepted v${debateBallots.length}`
          : `Re-Edit v${debateBallots.length}`
        : "Add ballot",
      enteredBy,
      enteredAt,
      room: d.roomId ? roomMap.get(d.roomId) ?? "—" : "—",
      affirmative: d.affirmativeTeamName ?? "—",
      negative: d.negativeTeamName ?? "—",
      winnerSide,
      adjudicators: (assignmentsByDebate.get(d.id) ?? []).join(", ") || "—",
      score: latest
        ? `${latest.affirmativePoints ?? "—"}–${latest.negativePoints ?? "—"}`
        : "—",
      reviewBallotId:
        latest && (latest.status === "submitted" || latest.status === "disputed")
          ? latest.id
          : null,
    };
  });

  return (
    <div className="space-y-6">
      <RoundStepNav roundId={roundId} roundName={round.name} current="results" />
      <PageHeader
        title="Results"
        description="Enter and review ballots. Adjudicator submissions show the adjudicator’s name."
        actions={
          <AddBallotDialog
            debates={debateRows.map((d) => ({
              id: d.id,
              label: `${d.affirmativeTeamName ?? "Aff"} vs ${d.negativeTeamName ?? "Neg"}`,
              affirmativeTeamId: d.affirmativeTeamId,
              negativeTeamId: d.negativeTeamId,
            }))}
          />
        }
      />
      <ResultsDataTable data={rows} />
    </div>
  );
}
