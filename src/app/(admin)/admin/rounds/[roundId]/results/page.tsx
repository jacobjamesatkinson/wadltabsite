import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { ballots, user } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { loadDrawView } from "@/lib/draw/view";
import { RoundStepNav } from "../round-step-nav";
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

  const view = round.drawStatus === "none" ? null : await loadDrawView(roundId);
  const debates = view?.debates ?? [];
  const debateIds = debates.map((d) => d.id);
  const [ballotRows, users] = await Promise.all([
    debateIds.length ? db.select().from(ballots).where(inArray(ballots.debateId, debateIds)) : Promise.resolve([]),
    db.select({ id: user.id, name: user.name }).from(user),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const adjNameById = new Map<string, string>();
  for (const d of debates) for (const a of d.adjudicators) adjNameById.set(a.id, a.name);

  const rows: ResultsRow[] = debates.map((d) => {
    const mine = ballotRows.filter((b) => b.debateId === d.id).sort((a, b) => b.version - a.version);
    const live = mine.find((b) => !b.discarded && b.status === "accepted") ?? mine.find((b) => !b.discarded && b.status === "submitted") ?? null;
    const status: ResultsRow["status"] = !live ? "none" : live.status === "accepted" ? "confirmed" : "unconfirmed";
    const enteredBy = live
      ? (live.adjudicatorId ? adjNameById.get(live.adjudicatorId) : null) ?? userName.get(live.submittedByUserId ?? "") ?? "—"
      : "—";
    let winnerSide: ResultsRow["winnerSide"] = "none";
    if (live?.winnerTeamId) {
      if (live.winnerTeamId === d.affirmative?.id) winnerSide = "aff";
      else if (live.winnerTeamId === d.negative?.id) winnerSide = "neg";
    }
    return {
      id: d.id,
      roundId,
      status,
      version: live?.version ?? null,
      versions: mine.length,
      enteredBy,
      enteredAt: live ? live.createdAt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "",
      confirmedBy: live?.confirmedBy ? userName.get(live.confirmedBy) ?? null : null,
      venue: d.venueName,
      timeslot: d.timeslotLabel,
      room: d.roomLabel || "—",
      affirmative: d.affirmative?.name ?? "Missing",
      negative: d.negative?.name ?? "Missing",
      incomplete: !d.affirmative || !d.negative,
      winnerSide,
      adjudicators: d.adjudicators.map((a) => a.name).join(", ") || "—",
      score: live ? `${live.affirmativePoints ?? "—"}–${live.negativePoints ?? "—"}` : "—",
      ballotId: live?.id ?? null,
    };
  });

  const confirmed = rows.filter((r) => r.status === "confirmed").length;
  const unconfirmed = rows.filter((r) => r.status === "unconfirmed").length;

  return (
    <div className="space-y-6">
      <RoundStepNav roundId={roundId} roundName={round.name} current="results" />
      <PageHeader
        title="Results"
        description={
          rows.length
            ? `${confirmed} of ${rows.length} confirmed${unconfirmed ? ` · ${unconfirmed} awaiting confirmation` : ""}. Enter a ballot per debate; a second person confirms it.`
            : "Create and release the draw before entering results."
        }
      />
      <ResultsDataTable data={rows} />
    </div>
  );
}