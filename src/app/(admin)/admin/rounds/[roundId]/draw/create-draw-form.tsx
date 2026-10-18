"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createDraw } from "@/app/actions/draws";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { DrawOptions } from "@/db/schema";
import type { DrawReport } from "@/lib/draw";
import { DrawReportView } from "./draw-report";

const TYPE_OPTIONS: Array<{ value: DrawOptions["type"]; label: string; hint: string }> = [
  { value: "power_paired", label: "Power-paired", hint: "Teams on the same number of wins debate each other (Tabbycat default)." },
  { value: "random", label: "Random", hint: "Teams are paired at random within their group." },
  { value: "round_robin", label: "Round-robin", hint: "Every team meets every other team in its group once." },
  { value: "manual", label: "Manual", hint: "Create empty rooms and build every matchup yourself." },
];

const ODD_OPTIONS: Array<{ value: DrawOptions["oddBracket"]; label: string }> = [
  { value: "pullup_top", label: "Pull up from top" },
  { value: "pullup_bottom", label: "Pull up from bottom" },
  { value: "pullup_middle", label: "Pull up from middle" },
  { value: "pullup_random", label: "Pull up at random" },
  { value: "intermediate", label: "Intermediate brackets" },
  { value: "intermediate_bubble_up_down", label: "Intermediate with bubble-up-bubble-down" },
];

const PAIRING_OPTIONS: Array<{ value: DrawOptions["pairingMethod"]; label: string }> = [
  { value: "slide", label: "Slide (1 v n/2+1)" },
  { value: "fold", label: "Fold (1 v n)" },
  { value: "adjacent", label: "Adjacent (1 v 2)" },
  { value: "random", label: "Random within bracket" },
  { value: "fold_top_adjacent_rest", label: "Fold top bracket, adjacent for the rest" },
];

const RESTRICTION_OPTIONS: Array<{ value: DrawOptions["pullupRestriction"]; label: string }> = [
  { value: "none", label: "No restriction" },
  { value: "least_to_date", label: "Fewest pull-ups to date" },
  { value: "lowest_ds_wins", label: "Lowest draw strength (wins)" },
  { value: "lowest_ds_speaks", label: "Lowest draw strength (speaks)" },
];

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="flex h-9 w-full border bg-background px-3 text-sm disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CreateDrawForm({
  roundId,
  roundNumber,
  defaults,
  blocked,
  onlyRoomIssues,
}: {
  roundId: string;
  roundNumber: number;
  defaults: DrawOptions;
  /** Preflight found fatal issues. */
  blocked: boolean;
  /** All fatal issues are room shortfalls, which can be forced. */
  onlyRoomIssues: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [options, setOptions] = useState<DrawOptions>(defaults);
  const [force, setForce] = useState(false);
  const [failed, setFailed] = useState<DrawReport | null>(null);

  const isPP = options.type === "power_paired";
  const firstRoundRandom = isPP && roundNumber === 1 && options.firstRoundType === "random";
  const set = <K extends keyof DrawOptions>(key: K, value: DrawOptions[K]) =>
    setOptions((o) => ({ ...o, [key]: value }));

  const canSubmit = !blocked || (onlyRoomIssues && force);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField id="type" label="Draw type" value={options.type} options={TYPE_OPTIONS} onChange={(v) => set("type", v)} />
        <div className="flex items-end pb-2 text-sm text-muted-foreground">
          {TYPE_OPTIONS.find((o) => o.value === options.type)?.hint}
        </div>
      </div>

      {firstRoundRandom ? (
        <p className="border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Round 1 has no results to power-pair on, so it will be drawn randomly within each group.
        </p>
      ) : null}

      {isPP ? (
        <fieldset className="grid gap-4 border p-4 md:grid-cols-2">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Power pairing
          </legend>
          <SelectField id="oddBracket" label="Odd bracket resolution" value={options.oddBracket} options={ODD_OPTIONS} onChange={(v) => set("oddBracket", v)} />
          <SelectField
            id="pullupRestriction"
            label="Pull-up restriction"
            value={options.pullupRestriction}
            options={RESTRICTION_OPTIONS}
            onChange={(v) => set("pullupRestriction", v)}
            disabled={!options.oddBracket.startsWith("pullup")}
          />
          <SelectField id="pairingMethod" label="Pairing method" value={options.pairingMethod} options={PAIRING_OPTIONS} onChange={(v) => set("pairingMethod", v)} />
          <SelectField
            id="conflictAvoidance"
            label="Conflict avoidance"
            value={options.conflictAvoidance}
            options={[
              { value: "one_up_one_down", label: "One-up-one-down" },
              { value: "off", label: "Off" },
            ]}
            onChange={(v) => set("conflictAvoidance", v)}
          />
          <div className="flex flex-wrap gap-6 md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={options.avoidHistory} onCheckedChange={(c) => set("avoidHistory", c === true)} />
              Avoid rematches
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={options.avoidSameInstitution} onCheckedChange={(c) => set("avoidSameInstitution", c === true)} />
              Avoid same-school debates
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={options.byeCountsAsWin} onCheckedChange={(c) => set("byeCountsAsWin", c === true)} />
              Byes count as wins for bracketing
            </label>
          </div>
        </fieldset>
      ) : null}

      {options.type !== "manual" ? (
        <SelectField
          id="sideAllocation"
          label="Side allocation"
          value={options.sideAllocation}
          options={[
            { value: "balance", label: "Balance (team that has affirmed less goes aff)" },
            { value: "random", label: "Random" },
          ]}
          onChange={(v) => set("sideAllocation", v)}
        />
      ) : null}

      {blocked && onlyRoomIssues ? (
        <label className="flex items-start gap-2 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <Checkbox checked={force} onCheckedChange={(c) => setForce(c === true)} className="mt-0.5" />
          <span>
            Create the draw anyway and leave rooms unassigned where a venue is short. You can
            assign rooms on the Matchups page.
          </span>
        </label>
      ) : null}

      {failed ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">
            The draw was not created. Fix the problems below and try again.
          </p>
          <DrawReportView report={failed} />
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          disabled={pending || !canSubmit}
          onClick={() =>
            startTransition(async () => {
              setFailed(null);
              try {
                const result = await createDraw({ roundId, options, force });
                if (!result.ok) {
                  setFailed(result.report);
                  toast.error("Draw could not be created");
                  return;
                }
                const warnings = result.report.issues.filter((i) => i.severity === "warning").length;
                toast.success(
                  warnings > 0
                    ? `Draft draw created with ${warnings} warning${warnings === 1 ? "" : "s"}`
                    : "Draft draw created"
                );
                router.refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to create draw");
              }
            })
          }
        >
          {pending ? "Generating…" : "Create draw"}
        </Button>
        {blocked && !onlyRoomIssues ? (
          <p className="text-sm text-destructive">Fix the “must fix” problems above first.</p>
        ) : null}
      </div>
    </div>
  );
}
