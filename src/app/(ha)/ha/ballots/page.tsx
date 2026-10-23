import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { ballots, rounds, user } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { loadDrawView } from "@/lib/draw/view";
import { HaRoundNav } from "../ha-round-nav";
import { HaBallotsTable, type HaBallotRow } from "./ha-ballots-table";

export default async function HaBallotsPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string }>;
}) {
  const { round: roundParam } = await searchParams;
  const roundRows = await db.select().from(rounds).orderBy(asc(rounds.number));
  const withDraw = roundRows.filter((r) => r.drawStatus !== "none");
  const active =
    withDraw.find((r) => r.id === roundParam) ??
    withDraw.find((r) => r.drawStatus === "published") ??
    withDraw[withDraw.length - 1] ??
    null;

  const view = active ? await loadDrawView(active.id) : null;
  const debates = view?.debates ?? [];
  const debateIds = debates.map((d) => d.id);
  const [ballotRows, users] = await Promise.all([
    debateIds.length
      ? db.select().from(ballots).where(inArray(ballots.debateId, debateIds))
      : Promise.resolve([]),
    db.select({ id: user.id, name: user.name }).from(user),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const adjNameById = new Map<string, string>();
  for (const d of debates) {
    for (const a of d.adjudicators) adjNameById.set(a.id, a.name);
  }

  const rows: HaBallotRow[] = debates.map((d) => {
    const mine = ballotRows
      .filter((b) => b.debateId === d.id)
      .sort((a, b) => b.version - a.version);
    const live =
      mine.find((b) => !b.discarded && b.status === "accepted") ??
      mine.find((b) => !b.discarded && b.status === "submitted") ??
      null;
    const status: HaBallotRow["status"] = !live
      ? "none"
      : live.status === "accepted"
        ? "confirmed"
        : "unconfirmed";
    const institutions = [
      ...new Set(
        [d.affirmative?.institutionName, d.negative?.institutionName].filter(
          (n): n is string => Boolean(n)
        )
      ),
    ].join(", ");
    const enteredBy = live
      ? (live.adjudicatorId
          ? adjNameById.get(live.adjudicatorId)
          : null) ??
        userName.get(live.submittedByUserId ?? "") ??
        "—"
      : "—";

    return {
      id: d.id,
      roundId: active!.id,
      status,
      version: live?.version ?? null,
      venue: d.venueName,
      timeslot: d.timeslotLabel,
      room: d.roomLabel || "—",
      division: d.divisionName,
      divisionSort: d.divisionSort,
      divisionChipColor: d.divisionChipColor,
      institutions: institutions || "—",
      affirmative: d.affirmative?.name ?? "Missing",
      negative: d.negative?.name ?? "Missing",
      incomplete: !d.affirmative || !d.negative,
      score: live
        ? `${live.affirmativePoints ?? "—"}–${live.negativePoints ?? "—"}`
        : "—",
      enteredBy,
      ballotId: live?.id ?? null,
    };
  });

  const unconfirmed = rows.filter((r) => r.status === "unconfirmed").length;
  const confirmed = rows.filter((r) => r.status === "confirmed").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <HaRoundNav
        rounds={withDraw.map((r) => ({
          id: r.id,
          name: r.name,
          number: r.number,
        }))}
        activeRoundId={active?.id ?? null}
        basePath="/ha/ballots"
        label="Ballots by round"
      />

      <div className="space-y-6">
        <PageHeader
          title={active ? `${active.name} ballots` : "Ballots"}
          description={
            active
              ? `${confirmed} confirmed · ${unconfirmed} awaiting confirmation · filter by institution, venue, timeslot, or division`
              : "Create a draw before reviewing ballots."
          }
        />
        {!active ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            No rounds with a draw yet
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            No debates in this round
          </div>
        ) : (
          <HaBallotsTable data={rows} />
        )}
      </div>
    </div>
  );
}
