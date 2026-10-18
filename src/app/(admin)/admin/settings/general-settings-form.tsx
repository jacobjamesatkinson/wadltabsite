"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateCompetitionConfig, updateSiteCompetitionName } from "@/app/actions/competitions";
import { generateAllTeamAccessLinks } from "@/app/actions/teams";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompetitionConfig, DrawOptions, ScoreConfig } from "@/db/schema";

export function GeneralSettingsForm({
  competitionName,
}: {
  competitionName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(competitionName);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="max-w-lg space-y-4 border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          try {
            await updateSiteCompetitionName(name);
            toast.success("Competition name saved");
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="competition-name">Competition name</Label>
        <Input
          id="competition-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. WADL Season 2026"
          required
          minLength={2}
        />
        <p className="text-xs text-muted-foreground">
          Shown across admin and public draw surfaces for this site.
        </p>
      </div>
      <Button type="submit" disabled={pending || name.trim().length < 2}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function GenerateAllTeamLinksForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="max-w-lg space-y-3 border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Team private URLs</h3>
        <p className="text-xs text-muted-foreground">
          Create a private team portal link for every team that does not already have one.
          Existing links are left unchanged.
        </p>
      </div>
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            try {
              const result = await generateAllTeamAccessLinks();
              toast.success(
                result.created === 0
                  ? `All ${result.total} teams already have a private URL`
                  : `Created ${result.created} new link${result.created === 1 ? "" : "s"} (${result.existing} already existed)`
              );
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
      >
        {pending ? "Generating…" : "Generate all team private URLs"}
      </Button>
    </div>
  );
}

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Select<T extends string>({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className="flex h-9 w-full border bg-background px-3 text-sm">
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CompetitionRulesForm({
  competitionId,
  config,
}: {
  competitionId: string;
  config: CompetitionConfig;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scores, setScores] = useState<ScoreConfig>(config.scores);
  const [draw, setDraw] = useState<DrawOptions>(config.draw);
  const [panelSize, setPanelSize] = useState(config.panelSize);

  const setScore = <K extends keyof ScoreConfig>(k: K, v: ScoreConfig[K]) => setScores((s) => ({ ...s, [k]: v }));
  const setDrawOpt = <K extends keyof DrawOptions>(k: K, v: DrawOptions[K]) => setDraw((d) => ({ ...d, [k]: v }));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (scores.min >= scores.max) {
          toast.error("Minimum score must be below the maximum");
          return;
        }
        startTransition(async () => {
          try {
            await updateCompetitionConfig(competitionId, {
              ...config,
              scores,
              draw,
              panelSize,
              bye: { ...config.bye, countsAsWin: draw.byeCountsAsWin },
            });
            toast.success("Rules saved");
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
    >
      <fieldset className="grid gap-4 border p-4 md:grid-cols-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ballots &amp; speaker scores</legend>
        <Field id="speakers" label="Speakers per team">
          <Input id="speakers" type="number" min={1} max={4} value={scores.speakersPerTeam} onChange={(e) => setScore("speakersPerTeam", Number(e.target.value))} />
        </Field>
        <Field id="min" label="Minimum speaker score">
          <Input id="min" type="number" value={scores.min} onChange={(e) => setScore("min", Number(e.target.value))} />
        </Field>
        <Field id="max" label="Maximum speaker score">
          <Input id="max" type="number" value={scores.max} onChange={(e) => setScore("max", Number(e.target.value))} />
        </Field>
        <Field id="step" label="Score step" hint="Use 0.5 to allow half points.">
          <Input id="step" type="number" step="0.5" min={0.5} value={scores.step} onChange={(e) => setScore("step", Number(e.target.value))} />
        </Field>
        <div className="flex flex-col justify-end gap-2 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={scores.allowLowPointWin} onCheckedChange={(c) => setScore("allowLowPointWin", c === true)} />
            Allow low-point wins (winner may have the lower total)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={scores.allowDraws} onCheckedChange={(c) => setScore("allowDraws", c === true)} />
            Allow draws (tied totals)
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 border p-4 md:grid-cols-2">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Default draw rules</legend>
        <Field id="type" label="Draw type">
          <Select
            id="type"
            value={draw.type}
            onChange={(v) => setDrawOpt("type", v)}
            options={[
              { value: "power_paired", label: "Power-paired" },
              { value: "random", label: "Random" },
              { value: "round_robin", label: "Round-robin" },
              { value: "manual", label: "Manual" },
            ]}
          />
        </Field>
        <Field id="odd" label="Odd bracket resolution">
          <Select
            id="odd"
            value={draw.oddBracket}
            onChange={(v) => setDrawOpt("oddBracket", v)}
            options={[
              { value: "pullup_top", label: "Pull up from top" },
              { value: "pullup_bottom", label: "Pull up from bottom" },
              { value: "pullup_middle", label: "Pull up from middle" },
              { value: "pullup_random", label: "Pull up at random" },
              { value: "intermediate", label: "Intermediate brackets" },
              { value: "intermediate_bubble_up_down", label: "Intermediate with bubble-up-bubble-down" },
            ]}
          />
        </Field>
        <Field id="pairing" label="Pairing method">
          <Select
            id="pairing"
            value={draw.pairingMethod}
            onChange={(v) => setDrawOpt("pairingMethod", v)}
            options={[
              { value: "slide", label: "Slide" },
              { value: "fold", label: "Fold" },
              { value: "adjacent", label: "Adjacent" },
              { value: "random", label: "Random within bracket" },
              { value: "fold_top_adjacent_rest", label: "Fold top, adjacent rest" },
            ]}
          />
        </Field>
        <Field id="restriction" label="Pull-up restriction">
          <Select
            id="restriction"
            value={draw.pullupRestriction}
            onChange={(v) => setDrawOpt("pullupRestriction", v)}
            options={[
              { value: "none", label: "None" },
              { value: "least_to_date", label: "Fewest pull-ups to date" },
              { value: "lowest_ds_wins", label: "Lowest draw strength (wins)" },
              { value: "lowest_ds_speaks", label: "Lowest draw strength (speaks)" },
            ]}
          />
        </Field>
        <Field id="conflict" label="Conflict avoidance">
          <Select
            id="conflict"
            value={draw.conflictAvoidance}
            onChange={(v) => setDrawOpt("conflictAvoidance", v)}
            options={[
              { value: "one_up_one_down", label: "One-up-one-down" },
              { value: "off", label: "Off" },
            ]}
          />
        </Field>
        <Field id="sides" label="Side allocation">
          <Select
            id="sides"
            value={draw.sideAllocation}
            onChange={(v) => setDrawOpt("sideAllocation", v)}
            options={[
              { value: "balance", label: "Balance affirmative/negative history" },
              { value: "random", label: "Random" },
            ]}
          />
        </Field>
        <div className="flex flex-wrap gap-6 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={draw.avoidHistory} onCheckedChange={(c) => setDrawOpt("avoidHistory", c === true)} />
            Avoid rematches
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={draw.avoidSameInstitution} onCheckedChange={(c) => setDrawOpt("avoidSameInstitution", c === true)} />
            Avoid same-school debates
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={draw.byeCountsAsWin} onCheckedChange={(c) => setDrawOpt("byeCountsAsWin", c === true)} />
            Byes count as wins
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 border p-4 md:grid-cols-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adjudication</legend>
        <Field id="panel" label="Adjudicators per room" hint="Auto-allocation fills this many seats per debate.">
          <Input id="panel" type="number" min={1} max={5} value={panelSize} onChange={(e) => setPanelSize(Number(e.target.value))} />
        </Field>
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save rules"}
      </Button>
    </form>
  );
}
