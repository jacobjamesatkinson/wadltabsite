export { dynamic, runtime } from "@/lib/db-dynamic";

import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  rounds,
  speakers,
  teamAccessTokens,
} from "@/db/schema";
import { hashToken } from "@/lib/tokens";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StudentSpeakerForm } from "./student-speaker-form";

export default async function TeamPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: raw } = await params;
  const token = await db.query.teamAccessTokens.findFirst({
    where: (t, { eq: e }) => e(t.tokenHash, hashToken(raw)),
  });
  if (!token || token.revokedAt) notFound();

  await db
    .update(teamAccessTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(teamAccessTokens.id, token.id));

  const team = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.id, token.teamId),
  });
  if (!team) notFound();

  const speakerRows = await db
    .select()
    .from(speakers)
    .where(eq(speakers.teamId, team.id));

  const published = await db
    .select()
    .from(rounds)
    .where(eq(rounds.drawStatus, "published"));
  const publishedIds = published.map((r) => r.id);
  const debateRows =
    publishedIds.length > 0
      ? await db.query.debates.findMany({
          where: (t, { and, inArray, or, eq: e }) =>
            and(
              inArray(t.roundId, publishedIds),
              or(e(t.affirmativeTeamId, team.id), e(t.negativeTeamId, team.id))
            ),
        })
      : [];

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-4 py-8">
      <PageHeader
        title={team.name}
        description={`Private team portal · ${team.wins}–${team.losses}`}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Published draw</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Affirmative</TableHead>
                <TableHead>Negative</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debateRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No published debates yet
                  </TableCell>
                </TableRow>
              ) : (
                debateRows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.affirmativeTeamName}</TableCell>
                    <TableCell>{d.negativeTeamName}</TableCell>
                    <TableCell>{d.status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Speakers</h2>
        <ul className="space-y-2">
          {speakerRows.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <span>{s.name}</span>
              {token.canEditSpeakers ? (
                <StudentSpeakerForm token={raw} speakerId={s.id} mode="remove" />
              ) : null}
            </li>
          ))}
        </ul>
        {token.canEditSpeakers ? (
          <StudentSpeakerForm token={raw} mode="add" />
        ) : (
          <p className="text-xs text-muted-foreground">
            Speaker editing is disabled for this link.
          </p>
        )}
      </section>
    </main>
  );
}
