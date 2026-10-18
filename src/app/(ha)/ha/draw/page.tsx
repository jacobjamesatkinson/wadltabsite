import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { rounds, venues } from "@/db/schema";
import { AllocationGrid } from "@/app/(admin)/admin/rounds/[roundId]/adjudicators/allocation-grid";
import { PageHeader } from "@/components/page-header";
import { loadAllocationData } from "@/lib/adjudicators/load";
import {
  formatDisplayDate,
  formatLocalDate,
  isRosterDay,
  rosterDayDate,
} from "@/lib/roster/dates";
import { cn } from "@/lib/utils";
import { HaRoundNav } from "../ha-round-nav";

function asLocalNoon(value: Date): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    12,
    0,
    0,
    0
  );
}

function venueDebateDate(
  roundStart: Date | null | undefined,
  rosterDay: string | null | undefined
): Date | null {
  if (!roundStart) return null;
  const monday = asLocalNoon(roundStart);
  if (rosterDay && isRosterDay(rosterDay)) {
    try {
      return rosterDayDate(monday, rosterDay);
    } catch {
      return monday;
    }
  }
  return monday;
}

export default async function HaDrawPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string; venue?: string }>;
}) {
  const { round: roundParam, venue: venueParam } = await searchParams;
  const roundRows = await db.select().from(rounds).orderBy(asc(rounds.number));
  const withDraw = roundRows.filter((r) => r.drawStatus !== "none");
  const active =
    withDraw.find((r) => r.id === roundParam) ??
    withDraw.find((r) => r.drawStatus === "published") ??
    withDraw[withDraw.length - 1] ??
    null;

  const data = active ? await loadAllocationData(active.id) : null;
  const venueRows = await db.select().from(venues);
  const venueMeta = new Map(venueRows.map((v) => [v.id, v]));

  const venuesSorted = data
    ? [...data.venues].sort((a, b) => {
        const da = venueDebateDate(active!.date, a.rosterDay);
        const db_ = venueDebateDate(active!.date, b.rosterDay);
        const aSort = da ? formatLocalDate(da) : "9999-99-99";
        const bSort = db_ ? formatLocalDate(db_) : "9999-99-99";
        return (
          aSort.localeCompare(bSort) ||
          a.name.localeCompare(b.name, undefined, { numeric: true })
        );
      })
    : [];

  const selected =
    venuesSorted.find((v) => v.id === venueParam) ?? venuesSorted[0] ?? null;

  const allocated = data
    ? data.venues.reduce(
        (sum, v) => sum + v.cells.filter((c) => c.assignments.length > 0).length,
        0
      )
    : 0;
  const total = data
    ? data.venues.reduce((sum, v) => sum + v.cells.length, 0)
    : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <HaRoundNav
        rounds={withDraw.map((r) => ({
          id: r.id,
          name: r.name,
          number: r.number,
        }))}
        activeRoundId={active?.id ?? null}
        basePath="/ha/draw"
        label="Draw by round"
      />

      <div className="space-y-6">
        <PageHeader
          title={active ? `${active.name} allocations` : "Draw & assignments"}
          description={
            active
              ? `${total} room${total === 1 ? "" : "s"} · ${allocated} allocated · ${data?.adjudicators.length ?? 0} adjudicators — same allocation tools as admin`
              : "Create a draw before assigning adjudicators."
          }
        />

        {!active || !data ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            No rounds with a draw yet
          </div>
        ) : venuesSorted.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            There are no debates to allocate in this round.
          </div>
        ) : (
          <>
            <nav
              className="flex flex-wrap gap-1 border-b"
              aria-label="Venues"
            >
              {venuesSorted.map((v) => {
                const done = v.cells.filter((c) => c.assignments.length > 0)
                  .length;
                const isActive = v.id === selected?.id;
                return (
                  <Link
                    key={v.id}
                    href={`/ha/draw?round=${active.id}&venue=${v.id}`}
                    className={cn(
                      "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm",
                      isActive
                        ? "border-foreground font-medium text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {v.name}
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        done === v.cells.length
                          ? "text-emerald-700"
                          : "text-muted-foreground"
                      )}
                    >
                      {done}/{v.cells.length}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {selected ? (
              <section className="overflow-hidden rounded-lg border">
                {(() => {
                  const meta = venueMeta.get(selected.id);
                  const debateDate = venueDebateDate(
                    active.date,
                    selected.rosterDay
                  );
                  const dateLabel = debateDate
                    ? formatDisplayDate(debateDate)
                    : null;
                  const address = meta?.address?.trim() || "";
                  const subtitle = [dateLabel, address || null]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div className="border-b bg-[#333] px-4 py-3 text-white">
                      <h2 className="text-lg font-semibold tracking-tight">
                        {selected.name}
                      </h2>
                      {subtitle ? (
                        <p className="mt-0.5 text-sm font-normal text-white/75">
                          {subtitle}
                        </p>
                      ) : null}
                    </div>
                  );
                })()}
                <div className="p-3">
                  <AllocationGrid data={data} venueId={selected.id} />
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
