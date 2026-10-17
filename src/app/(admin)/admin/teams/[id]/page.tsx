import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  ballots,
  debates,
  rooms,
  rounds,
  speakers,
  teamAccessTokens,
  timeslots,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import { getSiteCompetition } from "@/lib/competition";
import { formatTeamDisplayName } from "@/lib/teams/display-name";
import { TeamForm } from "../team-form";
import { TeamDebatesTable } from "./team-debates-table";
import { TeamPrivateLink } from "./team-private-link";
import { SpeakersManager } from "./speakers-manager";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const team = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.id, id),
  });
  if (!team) notFound();

  const [
    institution,
    competition,
    divisions,
    institutions,
    speakerRows,
    debateRows,
    roundRows,
    roomRows,
    slotRows,
    ballotRows,
    activeToken,
  ] = await Promise.all([
    team.institutionId
      ? db.query.institutions.findFirst({
          where: (t, { eq: e }) => e(t.id, team.institutionId!),
        })
      : Promise.resolve(undefined),
    getSiteCompetition(),
    db.query.divisions.findMany(),
    db.query.institutions.findMany(),
    db.select().from(speakers).where(eq(speakers.teamId, id)),
    db
      .select()
      .from(debates)
      .where(
        or(eq(debates.affirmativeTeamId, id), eq(debates.negativeTeamId, id))
      ),
    db.select().from(rounds),
    db.select().from(rooms),
    db.select().from(timeslots),
    db.select().from(ballots),
    db
      .select()
      .from(teamAccessTokens)
      .where(
        and(eq(teamAccessTokens.teamId, id), isNull(teamAccessTokens.revokedAt))
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const competitions = competition
    ? [{ id: competition.id, name: competition.name }]
    : [];
  const roundMap = new Map(roundRows.map((r) => [r.id, r]));
  const roomMap = new Map(roomRows.map((r) => [r.id, r.identifier]));
  const slotMap = new Map(slotRows.map((s) => [s.id, s.label]));

  const ballotsByDebate = new Map<string, (typeof ballotRows)[number][]>();
  for (const b of ballotRows) {
    const list = ballotsByDebate.get(b.debateId) ?? [];
    list.push(b);
    ballotsByDebate.set(b.debateId, list);
  }

  const debateTableRows = debateRows
    .map((d) => {
      const round = roundMap.get(d.roundId);
      const debateBallots = (ballotsByDebate.get(d.id) ?? []).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      const latest = debateBallots[0];
      let winnerSide: "aff" | "neg" | "none" = "none";
      if (latest?.winnerTeamId) {
        if (latest.winnerTeamId === d.affirmativeTeamId) winnerSide = "aff";
        else if (latest.winnerTeamId === d.negativeTeamId) winnerSide = "neg";
      }

      const thisSide =
        d.affirmativeTeamId === id
          ? "aff"
          : d.negativeTeamId === id
            ? "neg"
            : null;
      let result = "Pending";
      if (winnerSide !== "none" && thisSide) {
        result = winnerSide === thisSide ? "Win" : "Loss";
      } else if (latest) {
        result = latest.status;
      }

      return {
        id: d.id,
        roundId: d.roundId,
        round: round?.name ?? "—",
        roundNumber: round?.number ?? 0,
        room: d.roomId ? roomMap.get(d.roomId) ?? "—" : "—",
        timeslot: d.timeslotId ? slotMap.get(d.timeslotId) ?? "—" : "—",
        affirmative: d.affirmativeTeamName ?? "—",
        negative: d.negativeTeamName ?? "—",
        winnerSide,
        ballotLabel: latest
          ? `${latest.status} · ${latest.affirmativePoints ?? "—"}–${latest.negativePoints ?? "—"}`
          : "No ballot",
        ballotHref: latest
          ? `/admin/rounds/${d.roundId}/results`
          : null,
        result,
      };
    })
    .sort((a, b) => a.roundNumber - b.roundNumber);

  const privateUrl =
    activeToken?.accessToken != null
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/team/${activeToken.accessToken}`
      : null;

  const displayName = formatTeamDisplayName(team, institution);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/teams" className="hover:text-foreground">
          Teams
        </Link>
        <span>/</span>
        <span className="text-foreground">{displayName}</span>
      </div>

      <PageHeader
        title={displayName}
        description={`${team.identifier} · ${institution?.name ?? "Independent"} · ${team.wins}–${team.losses}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <TeamForm
              competitions={competitions}
              institutions={institutions.map((i) => ({
                id: i.id,
                name: i.name,
                shortName: i.shortName,
              }))}
              divisions={divisions.map((d) => ({
                id: d.id,
                name: d.name,
                competitionId: d.competitionId,
              }))}
              team={team}
            />
            <LinkButton href="/admin/teams" variant="outline" size="sm">
              Back
            </LinkButton>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant={team.status === "active" ? "default" : "secondary"}>
          {team.status}
        </Badge>
        <Badge variant="outline">{speakerRows.length} speakers</Badge>
        <Badge variant="outline">{debateTableRows.length} debates</Badge>
        {institution ? (
          <Link
            href={`/admin/institutions/${institution.id}`}
            className="inline-flex"
          >
            <Badge variant="outline">{institution.shortName}</Badge>
          </Link>
        ) : (
          <Badge variant="outline">Independent</Badge>
        )}
      </div>

      <TeamPrivateLink teamId={team.id} initialUrl={privateUrl} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Speakers</h2>
        <SpeakersManager
          teamId={team.id}
          speakers={speakerRows.map((s) => ({ id: s.id, name: s.name }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Debates</h2>
        <TeamDebatesTable rows={debateTableRows} />
      </section>
    </div>
  );
}
