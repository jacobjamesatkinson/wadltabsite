"use client";

import * as React from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PublicDrawDivisionTable } from "./public-draw-division-table";
import { PublicDrawVenueView } from "./public-draw-venue-view";
import type { PublicDrawRow, RoundMenuItem } from "./types";

function filterByInstitutions(
  rows: PublicDrawRow[],
  lockedInstitutions?: string[]
) {
  if (!lockedInstitutions?.length) return rows;
  const allowed = new Set(lockedInstitutions);
  return rows.filter((r) => r.institutions.some((name) => allowed.has(name)));
}

function roundHref(basePath: string, roundId: string) {
  if (basePath === "/" || basePath === "") return `/?round=${roundId}`;
  const sep = basePath.includes("?") ? "&" : "?";
  return `${basePath}${sep}round=${roundId}`;
}

export function PublicDrawListings({
  rows,
  roundMenus,
  currentRound,
  roundBasePath = "/",
  lockedInstitutions,
}: {
  rows: PublicDrawRow[];
  roundMenus: RoundMenuItem[];
  currentRound?: string;
  /**
   * Path used for round sidebar links (e.g. "/" or "/coordinator/draw").
   * Pass `null` to keep round selection in component state (no URL sync).
   */
  roundBasePath?: string | null;
  /** Only show debates involving these institutions; hides the institution filter. */
  lockedInstitutions?: string[];
}) {
  const scopedRows = React.useMemo(
    () => filterByInstitutions(rows, lockedInstitutions),
    [rows, lockedInstitutions]
  );

  const scopedRoundMenus = React.useMemo(() => {
    const ids = new Set(scopedRows.map((r) => r.roundId));
    return roundMenus.filter((r) => ids.has(r.id));
  }, [roundMenus, scopedRows]);

  const [view, setView] = React.useState<"division" | "venue">("venue");
  const [divisionId, setDivisionId] = React.useState<string | null>(null);
  const [localRound, setLocalRound] = React.useState<string | undefined>(
    currentRound
  );

  const requestedRound =
    roundBasePath == null ? localRound ?? currentRound : currentRound;

  const activeRound =
    requestedRound && scopedRoundMenus.some((r) => r.id === requestedRound)
      ? requestedRound
      : scopedRoundMenus[0]?.id;
  const activeRoundMeta = scopedRoundMenus.find((r) => r.id === activeRound);

  const roundRows = React.useMemo(
    () =>
      activeRound
        ? scopedRows.filter((r) => r.roundId === activeRound)
        : scopedRows,
    [scopedRows, activeRound]
  );

  const divisionGroups = React.useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; sort: number; rows: PublicDrawRow[] }
    >();
    for (const row of roundRows) {
      const existing = map.get(row.divisionId);
      if (existing) {
        existing.rows.push(row);
      } else {
        map.set(row.divisionId, {
          id: row.divisionId,
          name: row.divisionName,
          sort: row.divisionSort,
          rows: [row],
        });
      }
    }
    return [...map.values()].sort(
      (a, b) => a.sort - b.sort || a.name.localeCompare(b.name)
    );
  }, [roundRows]);

  const activeDivisionId =
    divisionId && divisionGroups.some((d) => d.id === divisionId)
      ? divisionId
      : (divisionGroups[0]?.id ?? null);

  const activeDivision = divisionGroups.find((d) => d.id === activeDivisionId);
  const divisionRows = activeDivision?.rows ?? [];

  React.useEffect(() => {
    setDivisionId(null);
  }, [activeRound]);

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav className="rounded-lg border bg-card" aria-label="Round draws">
        <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Draws by round
        </div>
        <ul className="divide-y">
          {scopedRoundMenus.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">
              No published draws yet
            </li>
          ) : (
            scopedRoundMenus.map((round) => {
              const active = round.id === activeRound;
              const className = cn(
                "block w-full px-3 py-2 text-left text-sm hover:bg-muted/50",
                active && "bg-muted font-medium text-foreground"
              );
              return (
                <li key={round.id}>
                  {roundBasePath != null ? (
                    <Link
                      href={roundHref(roundBasePath, round.id)}
                      className={className}
                    >
                      {round.name}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={className}
                      onClick={() => setLocalRound(round.id)}
                    >
                      {round.name}
                    </button>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </nav>

      <div className="space-y-4">
        <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {activeRoundMeta?.name ?? "Draw"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {lockedInstitutions?.length
                ? `${lockedInstitutions.join(", ")} · `
                : ""}
              {view === "venue"
                ? `All divisions · ${roundRows.length} debate${roundRows.length === 1 ? "" : "s"}`
                : activeDivision
                  ? `${activeDivision.name} · ${activeDivision.rows.length} debate${activeDivision.rows.length === 1 ? "" : "s"}`
                  : "Select a division to view its draw"}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Layout
              </p>
              <Tabs
                value={view}
                onValueChange={(v) =>
                  setView((v as "division" | "venue") ?? "venue")
                }
                className="gap-0"
              >
                <TabsList className="h-11 w-full max-w-md sm:w-auto">
                  <TabsTrigger value="venue" className="px-4 text-sm">
                    By venue
                  </TabsTrigger>
                  <TabsTrigger value="division" className="px-4 text-sm">
                    By division
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {view === "division" && divisionGroups.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Division
                </p>
                <Tabs
                  value={activeDivisionId ?? undefined}
                  onValueChange={(v) => setDivisionId(v ?? null)}
                  className="gap-0"
                >
                  <TabsList className="h-11 w-full flex-wrap justify-start sm:w-auto">
                    {divisionGroups.map((group) => (
                      <TabsTrigger
                        key={group.id}
                        value={group.id}
                        className="px-4 text-sm"
                      >
                        {group.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            ) : null}
          </div>
        </div>

        {roundRows.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            No published debates for this round
          </div>
        ) : view === "venue" ? (
          <PublicDrawVenueView
            rows={roundRows}
            lockedInstitutions={lockedInstitutions}
          />
        ) : !activeDivision ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            No divisions in this round
          </div>
        ) : (
          <PublicDrawDivisionTable
            rows={divisionRows}
            ariaLabel={`${activeDivision.name} draw`}
            idPrefix={activeDivision.id}
          />
        )}
      </div>
    </div>
  );
}
