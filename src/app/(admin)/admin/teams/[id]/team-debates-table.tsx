"use client";

import Link from "next/link";
import { EntityDataTable } from "@/components/data-table/entity-data-table";
import { cn } from "@/lib/utils";

export type TeamDebateRow = {
  id: string;
  roundId: string;
  round: string;
  room: string;
  timeslot: string;
  affirmative: string;
  negative: string;
  winnerSide: "aff" | "neg" | "none";
  ballotLabel: string;
  ballotHref: string | null;
  result: string;
};

function SideCell({
  name,
  side,
  winnerSide,
}: {
  name: string;
  side: "aff" | "neg";
  winnerSide: "aff" | "neg" | "none";
}) {
  const won = winnerSide === side;
  const lost = winnerSide !== "none" && winnerSide !== side;
  return (
    <span
      className={cn(
        "text-sm",
        won && "font-semibold text-emerald-700",
        lost && "text-muted-foreground"
      )}
    >
      {won ? "▲ " : lost ? "▼ " : ""}
      {name}
    </span>
  );
}

export function TeamDebatesTable({ rows }: { rows: TeamDebateRow[] }) {
  return (
    <EntityDataTable
      data={rows}
      ariaLabel="Team debates"
      pageSize={25}
      columns={[
        { id: "round", accessorKey: "round", label: "Round" },
        { id: "room", accessorKey: "room", label: "Room" },
        { id: "timeslot", accessorKey: "timeslot", label: "Timeslot" },
        {
          id: "affirmative",
          accessorKey: "affirmative",
          label: "Aff",
          cell: (row) => (
            <SideCell
              name={row.affirmative}
              side="aff"
              winnerSide={row.winnerSide}
            />
          ),
        },
        {
          id: "negative",
          accessorKey: "negative",
          label: "Neg",
          cell: (row) => (
            <SideCell
              name={row.negative}
              side="neg"
              winnerSide={row.winnerSide}
            />
          ),
        },
        {
          id: "result",
          accessorKey: "result",
          label: "Result",
          variant: "select",
        },
        {
          id: "ballotLabel",
          accessorKey: "ballotLabel",
          label: "Ballot",
          cell: (row) =>
            row.ballotHref ? (
              <Link
                href={row.ballotHref}
                className="text-violet-700 underline-offset-4 hover:underline"
              >
                {row.ballotLabel}
              </Link>
            ) : (
              <span className="text-muted-foreground">{row.ballotLabel}</span>
            ),
        },
      ]}
    />
  );
}
