import type { CompetitionConfig, DebateFlag, DrawOptions } from "@/db/schema";

/** A team as seen by the draw generator. All history is pre-computed by the caller. */
export type DrawTeam = {
  id: string;
  name: string;
  institutionId: string | null;
  divisionId: string | null;
  venueId: string | null;
  timeslotId: string | null;
  wins: number;
  losses: number;
  byes: number;
  /** Total speaker points to date (used as a tiebreaker). */
  speaks: number;
  /** Times this team has been pulled up in earlier rounds. */
  pullups: number;
  affCount: number;
  negCount: number;
  /** opponentTeamId -> number of times met. */
  history: Record<string, number>;
  /** Sum of opponents' wins to date (Tabbycat "draw strength by wins"). */
  drawStrengthWins: number;
  /** Sum of opponents' speaks to date (Tabbycat "draw strength by speaks"). */
  drawStrengthSpeaks: number;
};

export type DrawRoom = {
  id: string;
  venueId: string;
  identifier: string;
};

export type DrawTimeslot = {
  id: string;
  startsAt: string;
  sortOrder: number;
};

export type DrawVenue = {
  id: string;
  name: string;
};

export type DrawDivision = {
  id: string;
  name: string;
};

/** A key identifying one independent pairing group. */
export type GroupKey = {
  venueId: string;
  timeslotId: string;
  divisionId: string;
};

export function groupKeyString(key: GroupKey): string {
  return `${key.venueId}|${key.timeslotId}|${key.divisionId}`;
}

/** Side-agnostic pairing produced by a generator. teams[0] is the higher-ranked team. */
export type Pairing = {
  teams: [DrawTeam, DrawTeam];
  /** Points bracket (fractional for intermediate brackets). */
  bracket: number;
  roomRank: number;
  flags: DebateFlag[];
  /** Per-team flags keyed by team id (e.g. which team was the pullup). */
  teamFlags: Record<string, DebateFlag[]>;
  /** Set after side allocation: index into `teams` for the affirmative team. */
  affIndex: 0 | 1;
};

export type GeneratedDebate = {
  group: GroupKey;
  affirmativeTeamId: string;
  negativeTeamId: string;
  affirmativeTeamName: string;
  negativeTeamName: string;
  divisionId: string;
  venueId: string;
  timeslotId: string;
  roomId: string | null;
  bracket: number;
  roomRank: number;
  flags: DebateFlag[];
  isPullUp: boolean;
  isRematch: boolean;
  isSameInstitution: boolean;
};

export type GeneratedBye = {
  teamId: string;
  teamName: string;
  group: GroupKey;
  reason: string;
  automatic: boolean;
};

export type DrawIssueSeverity = "fatal" | "warning" | "info";

export type DrawIssueCode =
  | "team_missing_venue"
  | "team_missing_timeslot"
  | "team_missing_division"
  | "no_teams"
  | "single_team_group"
  | "odd_group_bye"
  | "second_bye"
  | "no_rooms_for_venue"
  | "room_shortfall"
  | "pullup"
  | "rematch"
  | "same_institution"
  | "unpaired_team"
  | "duplicate_team"
  | "manual_draw"
  | "round_robin_rematch"
  | "generator_error";

export type DrawIssue = {
  code: DrawIssueCode;
  severity: DrawIssueSeverity;
  message: string;
  teamIds?: string[];
  venueId?: string;
  timeslotId?: string;
  divisionId?: string;
  /** Where an admin can fix the underlying data. */
  fixHref?: string;
};

export class DrawFatalError extends Error {
  issues: DrawIssue[];
  constructor(issues: DrawIssue[]) {
    super(issues.map((i) => i.message).join("; "));
    this.name = "DrawFatalError";
    this.issues = issues;
  }
}

export type DrawStats = {
  groups: number;
  teams: number;
  debates: number;
  byes: number;
  pullups: number;
  rematches: number;
  sameInstitution: number;
  roomsUsed: number;
};

export type DrawReport = {
  issues: DrawIssue[];
  stats: DrawStats;
  fatal: boolean;
};

export type DrawGenerationInput = {
  teams: DrawTeam[];
  rooms: DrawRoom[];
  timeslots: DrawTimeslot[];
  venues: DrawVenue[];
  divisions: DrawDivision[];
  config: CompetitionConfig;
  /** Overrides on top of `config.draw`. */
  options?: Partial<DrawOptions>;
  /** 1-based round number, used by round-robin sequencing. */
  roundNumber: number;
  seed?: string;
};

export type DrawGenerationResult = {
  debates: GeneratedDebate[];
  byes: GeneratedBye[];
  report: DrawReport;
  options: DrawOptions;
  seed: string;
};

export type Rng = () => number;
