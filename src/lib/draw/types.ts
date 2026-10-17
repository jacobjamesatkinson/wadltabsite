import type { CompetitionConfig } from "@/db/schema";

export type DrawTeam = {
  id: string;
  name: string;
  institutionId: string | null;
  divisionId: string | null;
  wins: number;
  losses: number;
  byes: number;
  speakerPoints: number;
};

export type DrawRoom = {
  id: string;
  venueId: string;
  identifier: string;
};

export type DrawTimeslot = {
  id: string;
  label: string;
  sortOrder: number;
};

export type PriorMatch = {
  teamAId: string;
  teamBId: string;
};

export type GeneratedDebate = {
  affirmativeTeamId: string;
  negativeTeamId: string;
  affirmativeTeamName: string;
  negativeTeamName: string;
  divisionId: string | null;
  venueId: string | null;
  roomId: string | null;
  timeslotId: string | null;
  isPullUp: boolean;
  isRematch: boolean;
  isSameInstitution: boolean;
};

export type GeneratedBye = {
  teamId: string;
  reason: string;
  automatic: boolean;
};

export type DrawGenerationInput = {
  teams: DrawTeam[];
  rooms: DrawRoom[];
  timeslots: DrawTimeslot[];
  priorMatches: PriorMatch[];
  config: CompetitionConfig;
  seed?: string;
  scope?: "all" | "venue" | "division";
  scopeId?: string | null;
};

export type DrawGenerationResult = {
  debates: GeneratedDebate[];
  byes: GeneratedBye[];
  hardViolations: string[];
  softWarnings: string[];
  compromises: string[];
  seed: string;
};
