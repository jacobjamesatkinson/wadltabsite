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
import type { PublicDrawRow } from "./types";

function uniqueOptions(values: string[]) {
  return [...new Set(values.filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ label: value, value }));
}

type SortKey =
  | "divisionName"
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

export function PublicDrawVenueView({ rows }: { rows: PublicDrawRow[] }) {
  const [venues, setVenues] = useState<string[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [teamQuery, setTeamQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("room");
  const [sortDesc, setSortDesc] = useState(false);

  const venueOptions = useMemo(
    () => uniqueOptions(rows.map((r) => r.venue)),
    [rows]
  );
  const divisionOptions = useMemo(
    () => uniqueOptions(rows.map((r) => r.divisionName)),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = teamQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (venues.length && !venues.includes(r.venue)) return false;
      if (divisions.length && !divisions.includes(r.divisionName)) return false;
      if (
        q &&
        !`${r.affirmative} ${r.negative}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [rows, venues, divisions, teamQuery]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      Map<string, { sort: number; label: string; rows: PublicDrawRow[] }>
    >();
    for (const row of filtered) {
      if (!map.has(row.venue)) map.set(row.venue, new Map());
      const slots = map.get(row.venue)!;
      const key = row.timeslotId ?? row.timeslot;
      if (!slots.has(key)) {
        slots.set(key, {
          sort: row.timeslotSort,
          label: row.timeslot,
          rows: [],
        });
      }
      slots.get(key)!.rows.push(row);
    }

    const cmp = (a: PublicDrawRow, b: PublicDrawRow) => {
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      const result = av.localeCompare(bv);
      return sortDesc ? -result : result;
    };

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([venue, slots]) => ({
        venue,
        slots: [...slots.values()]
          .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
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
    venues.length > 0 || divisions.length > 0 || teamQuery.trim();

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
        grouped.map(({ venue, slots }) => (
          <section key={venue} className="overflow-hidden rounded-lg border">
            <div className="flex items-center gap-1.5 border-b bg-[#333] px-3 py-1.5 text-sm font-semibold text-white">
              <MapPin className="size-3.5 shrink-0 opacity-80" />
              {venue}
            </div>
            {slots.map((slot) => (
              <div
                key={`${venue}-${slot.label}`}
                className="border-b last:border-b-0"
              >
                <div className="border-b bg-[#444] px-3 py-1 text-xs font-semibold tracking-wide text-white">
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
                        active={sortKey === "divisionName"}
                        desc={sortDesc}
                        onClick={() => toggleSort("divisionName")}
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
                        <TableCell>{row.divisionName}</TableCell>
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
        ))
      )}
    </div>
  );
}
