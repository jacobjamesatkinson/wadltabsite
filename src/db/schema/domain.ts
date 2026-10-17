import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const roleEnum = pgEnum("app_role", [
  "admin",
  "coordinator",
  "adjudicator",
  "head_adjudicator",
]);

export const drawStatusEnum = pgEnum("draw_status", ["none", "draft", "published"]);
export const debateStatusEnum = pgEnum("debate_status", [
  "scheduled",
  "in_progress",
  "completed",
  "postponed",
  "cancelled",
]);
export const ballotStatusEnum = pgEnum("ballot_status", [
  "pending",
  "submitted",
  "accepted",
  "disputed",
  "amended",
]);
export const postponementStatusEnum = pgEnum("postponement_status", [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
]);
export type CompetitionConfig = {
  format: "two_team";
  ranking: {
    primary: "wins";
    tiebreakers: Array<"speaker_points" | "margin" | "ballot_count" | "team_name">;
  };
  bye: {
    prefer: "lowest_ranked";
    allowSecondBye: "only_if_necessary" | "admin_authorised";
    countsAsWin: boolean;
  };
  pairing: {
    avoidRematch: boolean;
    avoidSameInstitution: boolean;
    minimisePullUps: boolean;
  };
  sides: {
    enabled: boolean;
    balanceFairness: boolean;
  };
  panelSize: number;
  studentSpeakerEdit: boolean;
  publicShowAdjudicators: boolean;
};

export const defaultCompetitionConfig: CompetitionConfig = {
  format: "two_team",
  ranking: {
    primary: "wins",
    tiebreakers: ["speaker_points", "margin", "team_name"],
  },
  bye: {
    prefer: "lowest_ranked",
    allowSecondBye: "only_if_necessary",
    countsAsWin: false,
  },
  pairing: {
    avoidRematch: true,
    avoidSameInstitution: true,
    minimisePullUps: true,
  },
  sides: {
    enabled: true,
    balanceFairness: true,
  },
  panelSize: 1,
  studentSpeakerEdit: true,
  publicShowAdjudicators: true,
};

export const institutions = pgTable("institutions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  status: text("status").notNull().default("active"), // active | archived
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    institutionId: text("institution_id").references(() => institutions.id, {
      onDelete: "cascade",
    }),
    competitionId: text("competition_id"),
    venueId: text("venue_id"),
    divisionId: text("division_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("user_roles_user_idx").on(t.userId)]
);

export const institutionMemberships = pgTable(
  "institution_memberships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    permission: text("permission").notNull().default("coordinator"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("membership_unique").on(t.userId, t.institutionId)]
);

export const competitions = pgTable("competitions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  season: text("season").notNull(),
  status: text("status").notNull().default("draft"), // draft | open | closed | running | complete | archived
  config: jsonb("config").$type<CompetitionConfig>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const divisions = pgTable("divisions", {
  id: text("id").primaryKey(),
  competitionId: text("competition_id")
    .notNull()
    .references(() => competitions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  venueId: text("venue_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const venues = pgTable("venues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  status: text("status").notNull().default("active"),
  floorPlan: jsonb("floor_plan"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rooms = pgTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    venueId: text("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    identifier: text("identifier").notNull(),
    capacity: integer("capacity"),
    available: boolean("available").notNull().default(true),
    floorX: integer("floor_x"),
    floorY: integer("floor_y"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("room_venue_identifier").on(t.venueId, t.identifier)]
);

export const rounds = pgTable(
  "rounds",
  {
    id: text("id").primaryKey(),
    competitionId: text("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    name: text("name").notNull(),
    date: timestamp("date", { withTimezone: true }),
    drawStatus: drawStatusEnum("draw_status").notNull().default("none"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: text("published_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("round_competition_number").on(t.competitionId, t.number)]
);

export const timeslots = pgTable("timeslots", {
  id: text("id").primaryKey(),
  roundId: text("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const teams = pgTable(
  "teams",
  {
    id: text("id").primaryKey(),
    competitionId: text("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    institutionId: text("institution_id").references(() => institutions.id),
    divisionId: text("division_id").references(() => divisions.id),
    /** When bound to an institution: team number only (e.g. "1"). Otherwise freeform name. */
    name: text("name").notNull(),
    identifier: text("identifier").notNull(),
    status: text("status").notNull().default("active"),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    byes: integer("byes").notNull().default(0),
    speakerPoints: integer("speaker_points").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("team_competition_identifier").on(t.competitionId, t.identifier),
    index("teams_institution_idx").on(t.institutionId),
  ]
);

export const speakers = pgTable("speakers", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const debates = pgTable(
  "debates",
  {
    id: text("id").primaryKey(),
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    timeslotId: text("timeslot_id").references(() => timeslots.id),
    venueId: text("venue_id").references(() => venues.id),
    roomId: text("room_id").references(() => rooms.id),
    divisionId: text("division_id").references(() => divisions.id),
    affirmativeTeamId: text("affirmative_team_id").references(() => teams.id),
    negativeTeamId: text("negative_team_id").references(() => teams.id),
    // Snapshots for historical integrity
    affirmativeTeamName: text("affirmative_team_name"),
    negativeTeamName: text("negative_team_name"),
    status: debateStatusEnum("status").notNull().default("scheduled"),
    isPullUp: boolean("is_pull_up").notNull().default(false),
    isRematch: boolean("is_rematch").notNull().default(false),
    isSameInstitution: boolean("is_same_institution").notNull().default(false),
    drawVersionId: text("draw_version_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("debates_round_idx").on(t.roundId),
    index("debates_timeslot_idx").on(t.timeslotId),
  ]
);

export const byes = pgTable("byes", {
  id: text("id").primaryKey(),
  roundId: text("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  reason: text("reason").notNull(),
  automatic: boolean("automatic").notNull().default(true),
  authorisedBy: text("authorised_by").references(() => user.id),
  drawVersionId: text("draw_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const drawVersions = pgTable("draw_versions", {
  id: text("id").primaryKey(),
  roundId: text("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  status: text("status").notNull(), // draft | published | superseded
  scope: text("scope").notNull().default("all"), // all | venue | division
  scopeId: text("scope_id"),
  snapshot: jsonb("snapshot").notNull(),
  compromises: jsonb("compromises").$type<string[]>().notNull().default([]),
  hardViolations: jsonb("hard_violations").$type<string[]>().notNull().default([]),
  softWarnings: jsonb("soft_warnings").$type<string[]>().notNull().default([]),
  seed: text("seed"),
  createdBy: text("created_by").references(() => user.id),
  publishedBy: text("published_by").references(() => user.id),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adjudicatorProfiles = pgTable("adjudicator_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
  qualifications: text("qualifications"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adjudicatorConflicts = pgTable("adjudicator_conflicts", {
  id: text("id").primaryKey(),
  adjudicatorId: text("adjudicator_id")
    .notNull()
    .references(() => adjudicatorProfiles.id, { onDelete: "cascade" }),
  institutionId: text("institution_id").references(() => institutions.id),
  teamId: text("team_id").references(() => teams.id),
  reason: text("reason"),
});

export const adjudicatorAvailability = pgTable(
  "adjudicator_availability",
  {
    id: text("id").primaryKey(),
    adjudicatorId: text("adjudicator_id")
      .notNull()
      .references(() => adjudicatorProfiles.id, { onDelete: "cascade" }),
    timeslotId: text("timeslot_id")
      .notNull()
      .references(() => timeslots.id, { onDelete: "cascade" }),
    available: boolean("available").notNull().default(true),
  },
  (t) => [uniqueIndex("adj_availability_unique").on(t.adjudicatorId, t.timeslotId)]
);

/** Round-level team availability — unavailable teams are excluded from draws. */
export const teamAvailability = pgTable(
  "team_availability",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    available: boolean("available").notNull().default(true),
  },
  (t) => [uniqueIndex("team_availability_unique").on(t.teamId, t.roundId)]
);

/** Round-level room availability. */
export const roomAvailability = pgTable(
  "room_availability",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    available: boolean("available").notNull().default(true),
  },
  (t) => [uniqueIndex("room_availability_unique").on(t.roomId, t.roundId)]
);

export const adjudicatorAssignments = pgTable(
  "adjudicator_assignments",
  {
    id: text("id").primaryKey(),
    debateId: text("debate_id")
      .notNull()
      .references(() => debates.id, { onDelete: "cascade" }),
    adjudicatorId: text("adjudicator_id")
      .notNull()
      .references(() => adjudicatorProfiles.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("chair"), // chair | panellist | trainee
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("adj_assignment_unique").on(t.debateId, t.adjudicatorId)]
);

export const ballots = pgTable("ballots", {
  id: text("id").primaryKey(),
  debateId: text("debate_id")
    .notNull()
    .references(() => debates.id, { onDelete: "cascade" }),
  adjudicatorId: text("adjudicator_id").references(() => adjudicatorProfiles.id),
  submittedByUserId: text("submitted_by_user_id").references(() => user.id),
  status: ballotStatusEnum("status").notNull().default("pending"),
  winnerTeamId: text("winner_team_id").references(() => teams.id),
  affirmativePoints: integer("affirmative_points"),
  negativePoints: integer("negative_points"),
  margin: integer("margin"),
  feedback: text("feedback"),
  needsReview: boolean("needs_review").notNull().default(false),
  reviewNotes: text("review_notes"),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedBy: text("accepted_by").references(() => user.id),
});

export const teamAccessTokens = pgTable("team_access_tokens", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  tokenPrefix: text("token_prefix").notNull(),
  /** Raw URL segment so admins can re-copy the link without regenerating. */
  accessToken: text("access_token").unique(),
  canEditSpeakers: boolean("can_edit_speakers").notNull().default(false),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const postponementRequests = pgTable("postponement_requests", {
  id: text("id").primaryKey(),
  debateId: text("debate_id")
    .notNull()
    .references(() => debates.id, { onDelete: "cascade" }),
  requestedBy: text("requested_by")
    .notNull()
    .references(() => user.id),
  institutionId: text("institution_id")
    .notNull()
    .references(() => institutions.id),
  reason: text("reason").notNull(),
  status: postponementStatusEnum("status").notNull().default("pending"),
  decisionNotes: text("decision_notes"),
  decidedBy: text("decided_by").references(() => user.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invitations = pgTable("invitations", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: roleEnum("role").notNull(),
  institutionId: text("institution_id").references(() => institutions.id),
  competitionId: text("competition_id").references(() => competitions.id),
  tokenHash: text("token_hash").notNull().unique(),
  invitedBy: text("invited_by").references(() => user.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => user.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_created_idx").on(t.createdAt),
  ]
);
