"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  importCsvPaste,
  type ImportResult,
} from "@/app/actions/import";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  IMPORT_SPECS,
  parseCsv,
  type ImportKind,
} from "@/lib/csv/parse";

const KINDS = Object.keys(IMPORT_SPECS) as ImportKind[];

export function ImporterForm() {
  const router = useRouter();
  const [kind, setKind] = useState<ImportKind>("institutions");
  const [csv, setCsv] = useState<string>(IMPORT_SPECS.institutions.example);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);

  const spec = IMPORT_SPECS[kind];

  const preview = useMemo(() => {
    try {
      if (!csv.trim()) return null;
      const table = parseCsv(csv);
      return {
        ok: true as const,
        rows: table.rows.length,
        headers: table.headers,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Invalid CSV",
      };
    }
  }, [csv]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="import-kind">Import type</Label>
        <select
          id="import-kind"
          className="flex h-9 w-full max-w-md rounded-lg border px-2 text-sm"
          value={kind}
          onChange={(e) => {
            const next = e.target.value as ImportKind;
            setKind(next);
            setCsv(IMPORT_SPECS[next].example);
            setResult(null);
          }}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {IMPORT_SPECS[k].label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border p-4 text-sm">
        <p className="font-medium">Expected columns</p>
        <p className="mt-1 text-muted-foreground">{spec.columns}</p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="import-csv">Paste CSV</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setCsv(spec.example);
              setResult(null);
            }}
          >
            Load example
          </Button>
        </div>
        <Textarea
          id="import-csv"
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setResult(null);
          }}
          className="min-h-56 font-mono text-xs"
          spellCheck={false}
          placeholder="Paste CSV with a header row…"
        />
        {preview?.ok ? (
          <p className="text-xs text-muted-foreground">
            {preview.rows} data row{preview.rows === 1 ? "" : "s"} · headers:{" "}
            {preview.headers.join(", ")}
          </p>
        ) : preview ? (
          <p className="text-xs text-destructive">{preview.error}</p>
        ) : null}
      </div>

      <Button
        type="button"
        disabled={pending || !csv.trim() || preview?.ok === false}
        onClick={() => {
          startTransition(async () => {
            try {
              const next = await importCsvPaste({ kind, csv });
              setResult(next);
              if (next.errors === 0) {
                toast.success(
                  `Imported ${next.created} created · ${next.updated} updated`
                );
              } else {
                toast.message(
                  `Done with ${next.errors} error${next.errors === 1 ? "" : "s"}`
                );
              }
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Import failed");
            }
          });
        }}
      >
        {pending ? "Importing…" : "Import CSV"}
      </Button>

      {result ? (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">
            Created {result.created} · updated {result.updated} · skipped{" "}
            {result.skipped} · errors {result.errors}
          </p>
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {result.results.map((r) => (
              <li
                key={`${r.row}-${r.status}-${r.message}`}
                className={
                  r.status === "error"
                    ? "text-destructive"
                    : r.status === "skipped"
                      ? "text-muted-foreground"
                      : ""
                }
              >
                Row {r.row}: {r.status} — {r.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
