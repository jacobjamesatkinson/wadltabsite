"use client";

import { useMemo, useState } from "react";
import { MapPin, PlusCircle, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Faceted,
  FacetedBadge,
  FacetedBadgeList,
  FacetedClear,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedItemIndicator,
  FacetedList,
  FacetedTrigger,
  FacetedValue,
} from "@/components/ui/faceted";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DivisionChip } from "@/components/division-chip";
import type { PublicDrawRow } from "./types";

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function uniqueOptions(values: string[]) {
  return [...new Set(values.filter(Boolean))]
    .sort(naturalCompare)
    .map((value) => ({ label: value, value }));
}

type SortKey =
  | "divisionSort"
  | "room"
  | "affirmative"
  | "negative"
  | "comments";

function SortableHead({
  label,
  active,
  desc,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        className="-ms-1 inline-flex h-8 items-center gap-1 rounded-md px-1 text-sm font-medium hover:bg-accent"
        onClick={onClick}
      >
        {label}
        <span className="text-muted-foreground">
          {active ? (desc ? "↓" : "↑") : "↕"}
        </span>
      </button>
    </TableHead>
  );
}

function MultiFacetedFilter({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Array<{ label: string; value: string }>;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const hasSelection = value.length > 0;
  return (
    <Faceted
      value={value}
      onValueChange={(next) => {
        const values = Array.isArray(next) ? next : next ? [next] : [];
        onChange(values);
      }}
      items={options}
      multiple
    >
      <FacetedTrigger
        render={<Button variant="outline" className="border-dashed" />}
      >
        {hasSelection ? (
          <span
            aria-hidden="true"
            className="rounded-sm opacity-70 transition-opacity hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
          >
            <XCircle />
          </span>
        ) : (
          <PlusCircle />
        )}
        {title}
        {hasSelection ? (
          <>
            <Separator
              orientation="vertical"
              className="mx-0.5 data-vertical:h-4 data-vertical:self-center"
            />
            <FacetedValue>
              {(selected) => (
                <FacetedBadgeList>
                  {selected.length > 2 ? (
                    <FacetedBadge>{selected.length} selected</FacetedBadge>
                  ) : (
                    selected.map((item) => (
                      <FacetedBadge key={item.value}>
                        <span className="truncate">{item.label}</span>
                      </FacetedBadge>
                    ))
                  )}
                </FacetedBadgeList>
              )}
            </FacetedValue>
          </>
        ) : null}
      </FacetedTrigger>
      <FacetedContent aria-label={`${title} filter`} className="w-50">
        <FacetedInput placeholder={`Search ${title.toLowerCase()}…`} />
        <FacetedList className="max-h-full">
          <FacetedEmpty>No results found.</FacetedEmpty>
          <FacetedGroup className="max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto">
            {options.map((option) => (
              <FacetedItem key={option.value} value={option.value}>
                <span className="flex-1 truncate">{option.label}</span>
                <FacetedItemIndicator />
              </FacetedItem>
            ))}
          </FacetedGroup>
          <FacetedClear>Clear filters</FacetedClear>
        </FacetedList>
      </FacetedContent>
    </Faceted>
  );
}

export function PublicDrawVenueView({
  rows,
  lockedInstitutions,
}: {
  rows: PublicDrawRow[];
  /** When set, debates are already institution-scoped and the filter is hidden. */
  lockedInstitutions?: string[];
}) {
  const [venues, setVenues] = useState<string[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [institutions, setInstitutions] = useState<string[]>(
    lockedInstitutions ?? []
  );
  const [teamQuery, setTeamQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("room");
  const [sortDesc, setSortDesc] = useState(false);
  const institutionFilterLocked = Boolean(lockedInstitutions?.length);

  const venueOptions = useMemo(
    () => uniqueOptions(rows.map((r) => r.venue)),
    [rows]
  );
  const divisionOptions = useMemo(() => {
    const byName = new Map<string, number>();
    for (const r of rows) {
      if (!r.divisionName) continue;
      const prev = byName.get(r.divisionName);
      if (prev == null || r.divisionSort < prev) {
        byName.set(r.divisionName, r.divisionSort);
      }
    }
    return [...byName.entries()]
      .sort((a, b) => a[1] - b[1] || naturalCompare(a[0], b[0]))
      .map(([value]) => ({ label: value, value }));
  }, [rows]);
  const institutionOptions = useMemo(
    () => uniqueOptions(rows.flatMap((r) => r.institutions)),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = teamQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (venues.length && !venues.includes(r.venue)) return false;
      if (divisions.length && !divisions.includes(r.divisionName)) return false;
      if (
        institutions.length &&
        !r.institutions.some((name) => institutions.includes(name))
      ) {
        return false;
      }
      if (
        q &&
        !`${r.affirmative} ${r.negative}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [rows, venues, divisions, institutions, teamQuery]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        venue: string;
        address: string;
        date: string;
        dateSort: string;
        slots: Map<string, { sort: number; label: string; rows: PublicDrawRow[] }>;
      }
    >();

    for (const row of filtered) {
      let group = map.get(row.venue);
      if (!group) {
        group = {
          venue: row.venue,
          address: row.venueAddress,
          date: row.date,
          dateSort: row.dateSort,
          slots: new Map(),
        };
        map.set(row.venue, group);
      } else {
        if (!group.address && row.venueAddress) group.address = row.venueAddress;
        // Prefer a real roster-derived date over blank; otherwise keep the first.
        if ((!group.dateSort || group.date === "—") && row.dateSort) {
          group.date = row.date;
          group.dateSort = row.dateSort;
        }
      }

      const slotKey = row.timeslotId ?? row.timeslot;
      let slot = group.slots.get(slotKey);
      if (!slot) {
        slot = { sort: row.timeslotSort, label: row.timeslot, rows: [] };
        group.slots.set(slotKey, slot);
      }
      slot.rows.push(row);
    }

    const cmp = (a: PublicDrawRow, b: PublicDrawRow) => {
      let result: number;
      if (sortKey === "divisionSort") {
        result =
          a.divisionSort - b.divisionSort ||
          a.divisionName.localeCompare(b.divisionName);
      } else if (sortKey === "room") {
        result = naturalCompare(a.room, b.room);
      } else {
        result = String(a[sortKey] ?? "").localeCompare(
          String(b[sortKey] ?? "")
        );
      }
      return sortDesc ? -result : result;
    };

    return [...map.values()]
      .sort(
        (a, b) =>
          (a.dateSort || "9999-99-99").localeCompare(b.dateSort || "9999-99-99") ||
          naturalCompare(a.venue, b.venue)
      )
      .map((group) => ({
        venue: group.venue,
        address: group.address,
        date: group.date,
        slots: [...group.slots.values()]
          .sort((a, b) => a.sort - b.sort || naturalCompare(a.label, b.label))
          .map((slot) => ({
            ...slot,
            rows: [...slot.rows].sort(cmp),
          })),
      }));
  }, [filtered, sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(false);
    }
  }

  const hasFilters =
    venues.length > 0 ||
    divisions.length > 0 ||
    (!institutionFilterLocked && institutions.length > 0) ||
    teamQuery.trim();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <MultiFacetedFilter
          title="Venue"
          options={venueOptions}
          value={venues}
          onChange={setVenues}
        />
        <MultiFacetedFilter
          title="Division"
          options={divisionOptions}
          value={divisions}
          onChange={setDivisions}
        />
        {institutionFilterLocked ? null : (
          <MultiFacetedFilter
            title="Institution"
            options={institutionOptions}
            value={institutions}
            onChange={setInstitutions}
          />
        )}
        <Input
          value={teamQuery}
          onChange={(e) => setTeamQuery(e.target.value)}
          placeholder="Search teams…"
          className="h-8 w-40 lg:w-56"
        />
        {hasFilters ? (
          <Button
            variant="outline"
            className="border-dashed"
            onClick={() => {
              setVenues([]);
              setDivisions([]);
              if (!institutionFilterLocked) setInstitutions([]);
              setTeamQuery("");
            }}
          >
            <X />
            Reset
          </Button>
        ) : null}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No debates match the current filters
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map((group) => {
            const meta = [group.date !== "—" ? group.date : null, group.address || null]
              .filter(Boolean)
              .join(" · ");
            return (
              <section key={group.venue} className="overflow-hidden rounded-lg border">
                <div className="border-b bg-[#333] px-4 py-3 text-white">
                  <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                    <MapPin className="size-4 shrink-0 opacity-80" />
                    {group.venue}
                  </div>
                  {meta ? (
                    <p className="mt-0.5 ps-6 text-sm font-normal text-white/75">
                      {meta}
                    </p>
                  ) : null}
                </div>
                {group.slots.map((slot) => (
                  <div
                    key={`${group.venue}-${slot.label}`}
                    className="border-b last:border-b-0"
                  >
                    <div className="border-b bg-[#444] px-4 py-2 text-sm font-semibold tracking-wide text-white">
                      {slot.label}
                    </div>
                    <Table className="border-collapse text-[15px] [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
                      <TableHeader>
                        <TableRow>
                          <SortableHead
                            label="Room"
                            className="w-[100px]"
                            active={sortKey === "room"}
                            desc={sortDesc}
                            onClick={() => toggleSort("room")}
                          />
                          <SortableHead
                            label="Division"
                            className="w-[140px]"
                            active={sortKey === "divisionSort"}
                            desc={sortDesc}
                            onClick={() => toggleSort("divisionSort")}
                          />
                          <SortableHead
                            label="Affirmative"
                            active={sortKey === "affirmative"}
                            desc={sortDesc}
                            onClick={() => toggleSort("affirmative")}
                          />
                          <SortableHead
                            label="Negative"
                            active={sortKey === "negative"}
                            desc={sortDesc}
                            onClick={() => toggleSort("negative")}
                          />
                          <SortableHead
                            label="Comments"
                            active={sortKey === "comments"}
                            desc={sortDesc}
                            onClick={() => toggleSort("comments")}
                          />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {slot.rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.room}</TableCell>
                            <TableCell>
                              <DivisionChip
                                name={row.divisionName}
                                color={row.divisionChipColor}
                              />
                            </TableCell>
                            <TableCell>{row.affirmative}</TableCell>
                            <TableCell>{row.negative}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.comments}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
