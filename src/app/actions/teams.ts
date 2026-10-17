"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
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
import { buildTeamIdentifier } from "@/lib/teams/display-name";
import { generateRawToken, hashToken, tokenPrefix } from "@/lib/tokens";

const teamSchema = z.object({
  competitionId: z.string(),
  institutionId: z.string().nullable().optional(),
  divisionId: z.string().optional().nullable(),
  name: z.string().min(1),
  identifier: z.string().optional(),
  status: z.string().optional(),
});

async function resolveTeamFields(data: z.infer<typeof teamSchema>) {
  const institutionId = data.institutionId || null;
  let institution: { shortName: string } | null = null;
  if (institutionId) {
    institution =
      (await db.query.institutions.findFirst({
        where: (t, { eq: e }) => e(t.id, institutionId),
        columns: { shortName: true },
      })) ?? null;
    if (!institution) throw new Error("Institution not found");
    if (!/^\d+$/.test(data.name.trim())) {
      throw new Error("Institution teams use a numeric team number (e.g. 1)");
    }
  }
  const name = data.name.trim();
  const identifier = (
    data.identifier?.trim() ||
    buildTeamIdentifier(name, institution)
  ).toUpperCase();
  return { institutionId, name, identifier };
}

function assertTeamAccess(
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>,
  institutionId: string | null
) {
  if (hasPermission(ctx, "teams:manage_all")) return;
  if (!hasPermission(ctx, "teams:manage_own")) throw new Error("FORBIDDEN");
  if (!institutionId) throw new Error("FORBIDDEN");
  if (!canAccessInstitution(ctx, institutionId)) throw new Error("FORBIDDEN");
}

export async function updateTeam(id: string, input: z.infer<typeof teamSchema>) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");
  const data = teamSchema.parse(input);

  const team = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.id, id),
  });
  if (!team) throw new Error("NOT_FOUND");

  assertTeamAccess(ctx, team.institutionId);
  const fields = await resolveTeamFields(data);
  assertTeamAccess(ctx, fields.institutionId);

  await db
    .update(teams)
    .set({
      competitionId: data.competitionId,
      institutionId: fields.institutionId,
      divisionId: data.divisionId ?? null,
      name: fields.name,
      identifier: fields.identifier,
      status: data.status ?? team.status,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, id));
  await writeAudit({
    actorId: ctx.userId,
    action: "team.update",
    entityType: "team",
    entityId: id,
    details: { ...data, ...fields },
  });
  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${id}`);
  revalidatePath("/coordinator/teams");
  revalidatePath("/");
}

export async function deleteTeam(id: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");

  const team = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.id, id),
  });
  if (!team) throw new Error("NOT_FOUND");

  assertTeamAccess(ctx, team.institutionId);

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
  const fields = await resolveTeamFields(data);
  assertTeamAccess(ctx, fields.institutionId);

  const id = createId("team");
  await db.insert(teams).values({
    id,
    competitionId: data.competitionId,
    institutionId: fields.institutionId,
    divisionId: data.divisionId ?? null,
    name: fields.name,
    identifier: fields.identifier,
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "team.create",
    entityType: "team",
    entityId: id,
    details: { ...data, ...fields },
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
  assertTeamAccess(ctx, team.institutionId);

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Speaker name required");

  const id = createId("spk");
  await db.insert(speakers).values({ id, teamId, name: trimmed });
  await writeAudit({
    actorId: ctx.userId,
    action: "speaker.create",
    entityType: "speaker",
    entityId: id,
    details: { teamId, name: trimmed },
  });
  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${teamId}`);
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
  assertTeamAccess(ctx, team.institutionId);

  await db.delete(speakers).where(eq(speakers.id, speakerId));
  await writeAudit({
    actorId: ctx.userId,
    action: "speaker.delete",
    entityType: "speaker",
    entityId: speakerId,
  });
  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${team.id}`);
  revalidatePath("/coordinator/teams");
}

function teamPortalBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function assertCanManageTeamTokens(teamId: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHORIZED");

  const team = await db.query.teams.findFirst({
    where: (t, { eq: e }) => e(t.id, teamId),
  });
  if (!team) throw new Error("NOT_FOUND");
  assertTeamAccess(ctx, team.institutionId);
  return { ctx, team };
}

/** Return the existing active private URL, or create one if none exists. */
export async function getOrCreateTeamAccessLink(
  teamId: string,
  canEditSpeakers = true
): Promise<{ url: string; rawToken: string; created: boolean }> {
  const { ctx } = await assertCanManageTeamTokens(teamId);

  const [existing] = await db
    .select()
    .from(teamAccessTokens)
    .where(
      and(eq(teamAccessTokens.teamId, teamId), isNull(teamAccessTokens.revokedAt))
    )
    .limit(1);

  if (existing?.accessToken) {
    return {
      url: `${teamPortalBaseUrl()}/team/${existing.accessToken}`,
      rawToken: existing.accessToken,
      created: false,
    };
  }

  if (existing) {
    await db
      .update(teamAccessTokens)
      .set({ revokedAt: new Date() })
      .where(eq(teamAccessTokens.id, existing.id));
  }

  const raw = generateRawToken();
  const id = createId("tok");
  await db.insert(teamAccessTokens).values({
    id,
    teamId,
    tokenHash: hashToken(raw),
    tokenPrefix: tokenPrefix(raw),
    accessToken: raw,
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
  revalidatePath(`/admin/teams/${teamId}`);
  return {
    url: `${teamPortalBaseUrl()}/team/${raw}`,
    rawToken: raw,
    created: true,
  };
}

/** Explicitly revoke the current link and issue a new one. */
export async function regenerateTeamAccessLink(
  teamId: string,
  canEditSpeakers = true
): Promise<{ url: string; rawToken: string }> {
  const { ctx } = await assertCanManageTeamTokens(teamId);

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
    accessToken: raw,
    canEditSpeakers,
    createdBy: ctx.userId,
  });
  await writeAudit({
    actorId: ctx.userId,
    action: "team_token.regenerate",
    entityType: "team_access_token",
    entityId: id,
    details: { teamId, canEditSpeakers },
  });
  revalidatePath(`/admin/teams/${teamId}`);
  return {
    url: `${teamPortalBaseUrl()}/team/${raw}`,
    rawToken: raw,
  };
}

/** @deprecated Prefer getOrCreateTeamAccessLink / regenerateTeamAccessLink */
export async function createTeamAccessLink(
  teamId: string,
  canEditSpeakers: boolean
): Promise<{ url: string; rawToken: string }> {
  return regenerateTeamAccessLink(teamId, canEditSpeakers);
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
