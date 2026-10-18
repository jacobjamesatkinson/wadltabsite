import type {
  DrawIssue,
  DrawReport,
  GeneratedBye,
  GeneratedDebate,
} from "./types";

const SEVERITY_ORDER = { fatal: 0, warning: 1, info: 2 } as const;

export function buildReport(params: {
  issues: DrawIssue[];
  debates: GeneratedDebate[];
  byes: GeneratedBye[];
  groups: number;
  teams: number;
}): DrawReport {
  const issues = [...params.issues].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
  return {
    issues,
    fatal: issues.some((i) => i.severity === "fatal"),
    stats: {
      groups: params.groups,
      teams: params.teams,
      debates: params.debates.length,
      byes: params.byes.length,
      pullups: params.debates.filter((d) => d.isPullUp).length,
      rematches: params.debates.filter((d) => d.isRematch).length,
      sameInstitution: params.debates.filter((d) => d.isSameInstitution).length,
      roomsUsed: new Set(params.debates.map((d) => d.roomId).filter(Boolean)).size,
    },
  };
}
