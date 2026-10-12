export type AppRole = "admin" | "coordinator" | "adjudicator" | "head_adjudicator";

export type Permission =
  | "admin:manage"
  | "institutions:manage"
  | "institutions:view_own"
  | "teams:manage_all"
  | "teams:manage_own"
  | "teams:view_own"
  | "competitions:manage"
  | "draws:manage"
  | "draws:view_published"
  | "venues:manage"
  | "adjudicators:manage"
  | "adjudicators:availability"
  | "ballots:submit"
  | "ballots:review"
  | "results:manage"
  | "audit:view"
  | "accounts:manage"
  | "postponements:request"
  | "postponements:review"
  | "ha:venue_manage";

export type RoleAssignment = {
  role: AppRole;
  institutionId?: string | null;
  competitionId?: string | null;
  venueId?: string | null;
  divisionId?: string | null;
};

export type AuthContext = {
  userId: string;
  email: string;
  name: string;
  status: string;
  roles: RoleAssignment[];
};
