"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { addSpeakerFromBallot, submitBallot } from "@/app/actions/ballots";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ScoreConfig } from "@/db/schema";
import type { BallotTeam, BallotVersion } from "@/lib/ballots/load";
import { validateBallot, type SpeechInput } from "@/lib/ballots/validate";
import { cn } from "@/lib/utils";

type SideKey = "affirmative" | "negative";
type SpeakerOption = { id: string; name: string };

function emptySpeeches(n: number): SpeechInput[] {
  return Array.from({ length: n }, (_, i) => ({ position: i + 1, speakerId: null, score: null, ghost: false }));
}

function fromVersion(v: BallotVersion | null, side: SideKey, n: number): SpeechInput[] {
  if (!v) return emptySpeeches(n);
  const rows = v.speeches[side];
  return Array.from({ length: n }, (_, i) => {
    const r = rows.find((x) => x.position === i + 1);
    return { position: i + 1, speakerId: r?.speakerId ?? null, score: r?.score ?? null, ghost: r?.ghost ?? false };
  });
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function BallotForm({
  debateId,
  affirmative,
  negative,
  scores,
  existing,
  canConfirm,
  returnTo,
}: {
  debateId: string;
  affirmative: BallotTeam;
  negative: BallotTeam;
  scores: ScoreConfig;
  /** Ballot being edited (unconfirmed). A new version replaces it. */
  existing: BallotVersion | null;
  canConfirm: boolean;
  returnTo: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [aff, setAff] = React.useState<SpeechInput[]>(() => fromVersion(existing, "affirmative", scores.speakersPerTeam));
  const [neg, setNeg] = React.useState<SpeechInput[]>(() => fromVersion(existing, "negative", scores.speakersPerTeam));
  const [winnerOverride, setWinnerOverride] = React.useState<string | null>(existing?.winnerTeamId ?? null);
  const [feedback, setFeedback] = React.useState(existing?.feedback ?? "");
  const [touched, setTouched] = React.useState(false);

  const validation = validateBallot(
    {
      affirmative: { teamId: affirmative.id, speeches: aff },
      negative: { teamId: negative.id, speeches: neg },
      winnerTeamId: winnerOverride,
    },
    scores
  );
  const tied = validation.affTotal === validation.negTotal && aff.every((s) => s.score != null) && neg.every((s) => s.score != null);
  const needsWinnerChoice = tied && !scores.allowDraws && scores.allowLowPointWin;
  const showWinnerChoice = scores.allowLowPointWin;

  const submit = (confirm: boolean) =>
    startTransition(async () => {
      setTouched(true);
      if (!validation.ok) {
        toast.error(validation.errors[0] ?? Object.values(validation.fieldErrors)[0] ?? "Ballot is incomplete");
        return;
      }
      try {
        const result = await submitBallot({
          debateId,
          affirmative: aff,
          negative: neg,
          winnerTeamId: winnerOverride,
          feedback: feedback || undefined,
          replaceBallotId: existing && existing.status !== "accepted" ? existing.id : null,
          confirm,
        });
        toast.success(result.confirmed ? "Ballot confirmed" : "Ballot saved — awaiting confirmation");
        router.push(returnTo);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save ballot");
      }
    });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <SidePanel
          debateId={debateId}
          label="Affirmative"
          team={affirmative}
          speeches={aff}
          onChange={setAff}
          scores={scores}
          total={validation.affTotal}
          winner={validation.winnerTeamId === affirmative.id}
          fieldErrors={touched ? validation.fieldErrors : {}}
          side="affirmative"
        />
        <SidePanel
          debateId={debateId}
          label="Negative"
          team={negative}
          speeches={neg}
          onChange={setNeg}
          scores={scores}
          total={validation.negTotal}
          winner={validation.winnerTeamId === negative.id}
          fieldErrors={touched ? validation.fieldErrors : {}}
          side="negative"
        />
      </div>

      <div className="grid gap-4 border p-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Result</p>
          {validation.winnerTeamId ? (
            <p className="text-sm">
              <span className="font-semibold">
                {validation.winnerTeamId === affirmative.id ? affirmative.name : negative.name}
              </span>{" "}
              wins by {validation.margin} ({validation.affTotal}–{validation.negTotal})
            </p>
          ) : tied && scores.allowDraws ? (
            <p className="text-sm">Draw ({validation.affTotal}–{validation.negTotal})</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tied && !scores.allowDraws ? "Totals are tied — adjust the scores." : "Enter every score to see the result."}
            </p>
          )}
          {touched && validation.errors.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-destructive">
              {validation.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
        {showWinnerChoice ? (
          <div className="space-y-1.5">
            <Label htmlFor="winner">Declared winner{needsWinnerChoice ? " (required)" : ""}</Label>
            <select
              id="winner"
              value={winnerOverride ?? ""}
              onChange={(e) => setWinnerOverride(e.target.value || null)}
              className="h-9 border bg-background px-2 text-sm"
            >
              <option value="">By total</option>
              <option value={affirmative.id}>{affirmative.name}</option>
              <option value={negative.id}>{negative.name}</option>
            </select>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="feedback">Notes for the tab team (optional)</Label>
        <Textarea id="feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => submit(false)} variant={canConfirm ? "outline" : "default"}>
          {pending ? "Saving…" : existing && existing.status !== "accepted" ? "Save changes" : "Save ballot"}
        </Button>
        {canConfirm ? (
          <Button disabled={pending} onClick={() => submit(true)}>
            {pending ? "Saving…" : "Save and confirm"}
          </Button>
        ) : null}
        <Button variant="ghost" disabled={pending} onClick={() => router.push(returnTo)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function SidePanel({
  debateId,
  label,
  team,
  speeches,
  onChange,
  scores,
  total,
  winner,
  fieldErrors,
  side,
}: {
  debateId: string;
  label: string;
  team: BallotTeam;
  speeches: SpeechInput[];
  onChange: (next: SpeechInput[]) => void;
  scores: ScoreConfig;
  total: number;
  winner: boolean;
  fieldErrors: Record<string, string>;
  side: SideKey;
}) {
  const [speakers, setSpeakers] = React.useState<SpeakerOption[]>(team.speakers);

  React.useEffect(() => {
    setSpeakers(team.speakers);
  }, [team.speakers]);

  const update = (i: number, patch: Partial<SpeechInput>) =>
    onChange(speeches.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const usedSpeakers = speeches.map((s) => s.speakerId);

  const handleCreated = (speechIndex: number, created: SpeakerOption) => {
    setSpeakers((prev) => (prev.some((s) => s.id === created.id) ? prev : [...prev, created]));
    update(speechIndex, { speakerId: created.id });
  };

  return (
    <section className={cn("border", winner && "border-emerald-500")}>
      <div className="flex items-baseline justify-between border-b px-4 py-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <h2 className="font-semibold">{team.name}</h2>
        </div>
        <p className="text-sm tabular-nums">
          Total <span className="text-lg font-semibold">{total || "—"}</span>
          {winner ? <span className="ml-2 text-xs font-medium text-emerald-700">Winner</span> : null}
        </p>
      </div>
      <div className="divide-y">
        {speeches.map((speech, i) => {
          const error = fieldErrors[`${side}.${speech.position}`];
          const duplicate = speech.speakerId != null && usedSpeakers.indexOf(speech.speakerId) !== i;
          return (
            <div key={speech.position} className="grid grid-cols-[32px_minmax(0,1fr)_96px] items-start gap-3 px-4 py-2.5">
              <span className="pt-2 text-sm font-medium tabular-nums text-muted-foreground">{speech.position}</span>
              <div className="space-y-1">
                <SpeakerSearch
                  debateId={debateId}
                  teamId={team.id}
                  speakers={speakers}
                  value={speech.speakerId}
                  onSelect={(speakerId) => update(i, { speakerId })}
                  onCreated={(created) => handleCreated(i, created)}
                  invalid={Boolean(error)}
                  ariaLabel={`${label} speaker ${speech.position}`}
                />
                {duplicate ? (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={speech.ghost} onCheckedChange={(c) => update(i, { ghost: c === true })} />
                    Duplicate speech (iron-person) — not counted on the speaker tab
                  </label>
                ) : null}
                {error ? <p className="text-xs text-destructive">{error}</p> : null}
              </div>
              <Input
                type="number"
                inputMode="decimal"
                min={scores.min}
                max={scores.max}
                step={scores.step}
                value={speech.score ?? ""}
                onChange={(e) => update(i, { score: e.target.value === "" ? null : Number(e.target.value) })}
                className={cn("h-9 text-right tabular-nums", error && "border-destructive")}
                aria-label={`${label} score ${speech.position}`}
              />
            </div>
          );
        })}
      </div>
      <p className="border-t px-4 py-1.5 text-[11px] text-muted-foreground">
        Scores {scores.min}–{scores.max} in steps of {scores.step}
      </p>
    </section>
  );
}

function SpeakerSearch({
  debateId,
  teamId,
  speakers,
  value,
  onSelect,
  onCreated,
  invalid,
  ariaLabel,
}: {
  debateId: string;
  teamId: string;
  speakers: SpeakerOption[];
  value: string | null;
  onSelect: (speakerId: string | null) => void;
  onCreated: (speaker: SpeakerOption) => void;
  invalid?: boolean;
  ariaLabel: string;
}) {
  const selected = speakers.find((s) => s.id === value) ?? null;
  const [query, setQuery] = React.useState(selected?.name ?? "");
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [creating, startCreate] = React.useTransition();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  React.useEffect(() => {
    if (!open) setQuery(selected?.name ?? "");
  }, [selected?.name, open]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selected?.name ?? "");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, selected?.name]);

  const trimmed = query.trim();
  const needle = normalizeName(query);
  const matches = needle
    ? speakers.filter((s) => normalizeName(s.name).includes(needle))
    : speakers;
  const exactMatch = speakers.find((s) => normalizeName(s.name) === needle) ?? null;
  const canAdd = trimmed.length > 0 && !exactMatch;

  type Option =
    | { kind: "speaker"; speaker: SpeakerOption }
    | { kind: "add"; name: string };

  const options: Option[] = [
    ...matches.map((speaker) => ({ kind: "speaker" as const, speaker })),
    ...(canAdd ? [{ kind: "add" as const, name: trimmed.replace(/\s+/g, " ") }] : []),
  ];

  React.useEffect(() => {
    setActiveIndex(0);
  }, [needle, canAdd, matches.length]);

  const pickSpeaker = (speaker: SpeakerOption) => {
    onSelect(speaker.id);
    setQuery(speaker.name);
    setOpen(false);
  };

  const createSpeaker = (name: string) => {
    startCreate(async () => {
      try {
        const created = await addSpeakerFromBallot({ debateId, teamId, name });
        onCreated(created);
        setQuery(created.name);
        setOpen(false);
        toast.success(`Added ${created.name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add speaker");
      }
    });
  };

  const activate = (option: Option | undefined) => {
    if (!option || creating) return;
    if (option.kind === "speaker") pickSpeaker(option.speaker);
    else createSpeaker(option.name);
  };

  const commitFromQuery = () => {
    if (exactMatch) {
      pickSpeaker(exactMatch);
      return;
    }
    if (canAdd) {
      createSpeaker(trimmed.replace(/\s+/g, " "));
      return;
    }
    if (matches[0]) {
      pickSpeaker(matches[0]);
      return;
    }
    setOpen(false);
    setQuery(selected?.name ?? "");
  };

  return (
    <div ref={rootRef} className="relative">
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        value={query}
        disabled={creating}
        placeholder="Search or add speaker…"
        autoComplete="off"
        className={cn("h-9", invalid && "border-destructive")}
        onFocus={() => {
          setOpen(true);
          setActiveIndex(0);
        }}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          if (selected && next !== selected.name) onSelect(null);
          if (!next.trim()) onSelect(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((i) => (options.length === 0 ? 0 : (i + 1) % options.length));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((i) => (options.length === 0 ? 0 : (i - 1 + options.length) % options.length));
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (open && options[activeIndex]) activate(options[activeIndex]);
            else commitFromQuery();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setQuery(selected?.name ?? "");
            return;
          }
          if (e.key === "Tab") {
            setOpen(false);
            if (trimmed && !value) {
              if (exactMatch) onSelect(exactMatch.id);
              else setQuery(selected?.name ?? "");
            }
          }
        }}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto border bg-popover py-1 text-sm shadow-md"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">Type a name to add a speaker</li>
          ) : (
            options.map((option, index) => {
              const active = index === activeIndex;
              if (option.kind === "speaker") {
                return (
                  <li
                    key={option.speaker.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={option.speaker.id === value}
                    className={cn(
                      "cursor-pointer px-3 py-1.5",
                      active && "bg-muted",
                      option.speaker.id === value && "font-medium"
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSpeaker(option.speaker)}
                  >
                    {option.speaker.name}
                  </li>
                );
              }
              return (
                <li
                  key="__add__"
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={false}
                  className={cn(
                    "cursor-pointer border-t px-3 py-1.5 text-muted-foreground",
                    active && "bg-muted text-foreground"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => createSpeaker(option.name)}
                >
                  {creating ? "Adding…" : <>Add “{option.name}” as new speaker</>}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
