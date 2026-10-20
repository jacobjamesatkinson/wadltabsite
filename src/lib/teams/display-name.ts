export type TeamNameParts = {
  name: string;
  institutionId?: string | null;
};

export type InstitutionNameParts = {
  shortName: string;
  name?: string;
};

/** Display label used in draws and most lists: "PMOD 1", or freeform if unbound. */
export function formatTeamDisplayName(
  team: TeamNameParts,
  institution?: InstitutionNameParts | null
): string {
  if (team.institutionId && institution?.shortName) {
    const raw = team.name.trim();
    if (/^\d+$/.test(raw)) {
      return `${institution.shortName} ${raw}`;
    }
    const trailingNumber = raw.match(/(\d+)\s*$/)?.[1];
    if (trailingNumber) {
      return `${institution.shortName} ${trailingNumber}`;
    }
    return `${institution.shortName} ${raw}`;
  }
  return team.name;
}

export function buildTeamIdentifier(
  teamName: string,
  institution?: InstitutionNameParts | null
): string {
  if (institution?.shortName) {
    return `${institution.shortName}-${teamName}`.toUpperCase().replace(/\s+/g, "");
  }
  return teamName.toUpperCase().replace(/\s+/g, "-");
}

/** Natural order: "CCGS 2" before "CCGS 10". */
export function compareTeamNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
