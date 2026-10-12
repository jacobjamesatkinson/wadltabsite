"use client";

import { useRouter } from "next/navigation";

type Opt = { id: string; name: string };

export function PublicFilters({
  venues,
  institutions,
  divisions,
  rounds,
  timeslots,
  current,
}: {
  venues: Opt[];
  institutions: Opt[];
  divisions: Opt[];
  rounds: Opt[];
  timeslots: Opt[];
  current: Record<string, string | undefined>;
}) {
  const router = useRouter();

  function update(key: string, value: string) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(current)) {
      if (v) params.set(k, v);
    }
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/public/draw?${params.toString()}`);
  }

  const fields: Array<{ key: string; label: string; options: Opt[] }> = [
    { key: "venue", label: "Venue", options: venues },
    { key: "institution", label: "Institution", options: institutions },
    { key: "division", label: "Division", options: divisions },
    { key: "round", label: "Round", options: rounds },
    { key: "timeslot", label: "Timeslot", options: timeslots },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {fields.map((f) => (
        <label key={f.key} className="space-y-1 text-xs">
          <span className="text-muted-foreground">{f.label}</span>
          <select
            className="flex h-8 min-w-[140px] rounded-lg border bg-background px-2 text-sm"
            value={current[f.key] ?? ""}
            onChange={(e) => update(f.key, e.target.value)}
          >
            <option value="">All</option>
            {f.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
