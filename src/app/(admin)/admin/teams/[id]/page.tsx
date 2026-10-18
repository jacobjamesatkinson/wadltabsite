import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  ballots,
  competitionTimeslots,
  debates,
  rooms,
  rounds,
  speakerDeletionRequests,
  speakers,
  teamAccessTokens,
} from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { LinkButton } from "@/components/link-button";
import { ensureSiteCompetition } from "@/lib/competition";
import { formatTeamDisplayName } from "@/lib/teams/display-name";
import { formatTimeslotTime } from "@/lib/timeslots/format";
import { TeamForm } from "../team-form";
import { SpeakerDeletionRequests } from "./speaker-deletion-requests";
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

  const competition = await ensureSiteCompetition();
  const [
    institution,
    divisions,
    institutions,
    venues,
    competitionSlots,
    speakerRows,
    debateRows,
    roundRows,
    roomRows,
    ballotRows,
    activeToken,
    pendingDeletionRows,
  ] = await Promise.all([
    team.institutionId
      ? db.query.institutions.findFirst({
          where: (t, { eq: e }) => e(t.id, team.institutionId!),
        })
      : Promise.resolve(undefined),
    db.query.divisions.findMany({
      where: (t, { eq: e }) => e(t.competitionId, competition.id),
    }),
    db.query.institutions.findMany(),
    db.query.venues.findMany(),
    db
      .select()
      .from(competitionTimeslots)
      .where(eq(competitionTimeslots.competitionId, competition.id)),
    db.select().from(speakers).where(eq(speakers.teamId, id)),
    db
      .select()
      .from(debates)
      .where(
        or(eq(debates.affirmativeTeamId, id), eq(debates.negativeTeamId, id))
      ),
    db.select().from(rounds),
    db.select().from(rooms),
    db.select().from(ballots),
    db
      .select()
      .from(teamAccessTokens)
      .where(
        and(eq(teamAccessTokens.teamId, id), isNull(teamAccessTokens.revokedAt))
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(speakerDeletionRequests)
      .where(
        and(
          eq(speakerDeletionRequests.teamId, id),
          eq(speakerDeletionRequests.status, "pending")
        )
      ),
  ]);
  const roundMap = new Map(roundRows.map((r) => [r.id, r]));
  const roomMap = new Map(roomRows.map((r) => [r.id, r.identifier]));
  const slotMap = new Map(
    competitionSlots.map((s) => [s.id, formatTimeslotTime(s.startsAt)])
  );

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
              competitionId={competition.id}
              institutions={institutions.map((i) => ({
                id: i.id,
                name: i.name,
                shortName: i.shortName,
              }))}
              divisions={divisions.map((d) => ({
                id: d.id,
                name: d.name,
              }))}
              venues={venues.map((v) => ({ id: v.id, name: v.name }))}
              timeslots={[...competitionSlots]
                .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                .map((t) => ({
                  id: t.id,
                  startsAt: t.startsAt,
                }))}
              team={team}
            />
            <LinkButton href="/admin/teams" variant="outline" size="sm">
              Back
            </LinkButton>
          </div>
        }
      />

      <TeamPrivateLink teamId={team.id} initialUrl={privateUrl} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Speakers</h2>
        <SpeakerDeletionRequests
          requests={pendingDeletionRows.map((r) => ({
            id: r.id,
            speakerName:
              speakerRows.find((s) => s.id === r.speakerId)?.name ??
              "Unknown speaker",
          }))}
        />
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
