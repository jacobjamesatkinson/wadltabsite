"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { speakers, teamAccessTokens, teams } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth/session";
import { createId } from "@/lib/id";
import {
  canAccessInstitution,
  requirePermission,
  hasPermission,
} from "@/lib/permissions";
import { generateRawToken, hashToken, tokenPrefix } from "@/lib/tokens";

const teamSchema = z.object({
  competitionId: z.string(),
  institutionId: z.string(),
  divisionId: z.string().optional().nullable(),
  name: z.string().min(1),
  identifier: z.string().min(1),
});

export async function updateTeam(id: string, input: z.infer<typeof teamSchema> & { status?: string }) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  const data = teamSchema.extend({ status: z.string().optional() }).parse(input);

  const team = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.id, id),
  });
  if (!team) throw new Error("NOT_FOUND");

  if (hasPermission(ctx, "teams:manage_all")) {
    // ok
  } else if (hasPermission(ctx, "teams:manage_own")) {
    if (!canAccessInstitution(ctx, team.institutionId)) throw new Error("FORBIDDEN");
    if (!canAccessInstitution(ctx, data.institutionId)) throw new Error("FORBIDDEN");
  } else {
    throw new Error("FORBIDDEN");
  }

  await db
    .update(teams)
    .set({
      competitionId: data.competitionId,
      institutionId: data.institutionId,
      divisionId: data.divisionId ?? null,
      name: data.name,
      identifier: data.identifier.toUpperCase(),
      status: data.status ?? team.status,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, id));
  await writeAudit({
    actorId: ctx.userId,
    action: "team.update",
    entityType: "team",
    entityId: id,
    details: data,
  });
  revalidatePath("/admin/teams");
  revalidatePath("/coordinator/teams");
}

export async function deleteTeam(id: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");

  const team = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.id, id),
  });
  if (!team) throw new Error("NOT_FOUND");

  if (hasPermission(ctx, "teams:manage_all")) {
    // ok
  } else if (hasPermission(ctx, "teams:manage_own")) {
    if (!canAccessInstitution(ctx, team.institutionId)) throw new Error("FORBIDDEN");
  } else {
    throw new Error("FORBIDDEN");
  }

  await db.delete(speakers).where(eq(speakers.teamId, id));
  await db.delete(teamAccessTokens).where(eq(teamAccessTokens.teamId, id));
  await db.delete(teams).where(eq(teams.id, id));
  await writeAudit({
    actorId: ctx.userId,
    action: "team.delete",
    entityType: "team",
    entityId: id,
  });
  revalidatePath("/admin/teams");
  revalidatePath("/coordinator/teams");
}

export async function createTeam(input: z.infer<typeof teamSchema>) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  const data = teamSchema.parse(input);

  if (hasPermission(ctx, "teams:manage_all")) {
    // ok
  } else if (hasPermission(ctx, "teams:manage_own")) {
    if (!canAccessInstitution(ctx, data.institutionId)) throw new Error("FORBIDDEN");
  } else {
    throw new Error("FORBIDDEN");
  }

  const id = createId("team");
  await db.insert(teams).values({
    id,
    competitionId: data.competitionId,
    institutionId: data.institutionId,
    divisionId: data.divisionId ?? null,
    name: data.name,
    identifier: data.identifier.toUpperCase(),
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "team.create",
    entityType: "team",
    entityId: id,
    details: data,
  });
  revalidatePath("/admin/teams");
  revalidatePath("/coordinator/teams");
  return { id };
}

export async function addSpeaker(teamId: string, name: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");

  const team = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.id, teamId),
  });
  if (!team) throw new Error("NOT_FOUND");

  if (!hasPermission(ctx, "teams:manage_all")) {
    if (!hasPermission(ctx, "teams:manage_own")) throw new Error("FORBIDDEN");
    if (!canAccessInstitution(ctx, team.institutionId)) throw new Error("FORBIDDEN");
  }

  const id = createId("spk");
  await db.insert(speakers).values({ id, teamId, name });
  await writeAudit({
    actorId: ctx.userId,
    action: "speaker.create",
    entityType: "speaker",
    entityId: id,
    details: { teamId, name },
  });
  revalidatePath("/admin/teams");
  revalidatePath("/coordinator/teams");
  return { id };
}

export async function removeSpeaker(speakerId: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");

  const speaker = await db.query.speakers.findFirst({
    where: (t, { eq: e }) => e(t.id, speakerId),
  });
  if (!speaker) throw new Error("NOT_FOUND");
  const team = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.id, speaker.teamId),
  });
  if (!team) throw new Error("NOT_FOUND");

  if (!hasPermission(ctx, "teams:manage_all")) {
    if (!hasPermission(ctx, "teams:manage_own")) throw new Error("FORBIDDEN");
    if (!canAccessInstitution(ctx, team.institutionId)) throw new Error("FORBIDDEN");
  }

  await db.delete(speakers).where(eq(speakers.id, speakerId));
  await writeAudit({
    actorId: ctx.userId,
    action: "speaker.delete",
    entityType: "speaker",
    entityId: speakerId,
  });
  revalidatePath("/admin/teams");
  revalidatePath("/coordinator/teams");
}

export async function createTeamAccessLink(
  teamId: string,
  canEditSpeakers: boolean
): Promise<{ url: string; rawToken: string }> {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");

  const team = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.id, teamId),
  });
  if (!team) throw new Error("NOT_FOUND");

  if (!hasPermission(ctx, "teams:manage_all")) {
    requirePermission(ctx, "teams:manage_own");
    if (!canAccessInstitution(ctx, team.institutionId)) throw new Error("FORBIDDEN");
  }

  // Revoke existing
  await db
    .update(teamAccessTokens)
    .set({ revokedAt: new Date() })
    .where(eq(teamAccessTokens.teamId, teamId));

  const raw = generateRawToken();
  const id = createId("tok");
  await db.insert(teamAccessTokens).values({
    id,
    teamId,
    tokenHash: hashToken(raw),
    tokenPrefix: tokenPrefix(raw),
    canEditSpeakers,
    createdBy: ctx.userId,
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "team_token.create",
    entityType: "team_access_token",
    entityId: id,
    details: { teamId, canEditSpeakers },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { url: `${base}/team/${raw}`, rawToken: raw };
}

export async function studentAddSpeaker(rawToken: string, name: string) {
  const token = await db.query.teamAccessTokens.findFirst({
    where: (t, { eq: e }) => e(t.tokenHash, hashToken(rawToken)),
  });
  if (!token || token.revokedAt) throw new Error("INVALID_TOKEN");
  if (!token.canEditSpeakers) throw new Error("FORBIDDEN");

  const id = createId("spk");
  await db.insert(speakers).values({ id, teamId: token.teamId, name });
  await writeAudit({
    action: "speaker.create.student",
    entityType: "speaker",
    entityId: id,
    details: { teamId: token.teamId, via: "token" },
  });
  revalidatePath(`/team/${rawToken}`);
  return { id };
}

export async function studentRemoveSpeaker(rawToken: string, speakerId: string) {
  const token = await db.query.teamAccessTokens.findFirst({
    where: (t, { eq: e }) => e(t.tokenHash, hashToken(rawToken)),
  });
  if (!token || token.revokedAt) throw new Error("INVALID_TOKEN");
  if (!token.canEditSpeakers) throw new Error("FORBIDDEN");

  const speaker = await db.query.speakers.findFirst({
    where: (t, { eq: e }) => e(t.id, speakerId),
  });
  if (!speaker || speaker.teamId !== token.teamId) throw new Error("FORBIDDEN");

  await db.delete(speakers).where(eq(speakers.id, speakerId));
  await writeAudit({
    action: "speaker.delete.student",
    entityType: "speaker",
    entityId: speakerId,
    details: { teamId: token.teamId, via: "token" },
  });
  revalidatePath(`/team/${rawToken}`);
}
