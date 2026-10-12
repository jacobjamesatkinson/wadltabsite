import { PageHeader } from "@/components/page-header";
import { defaultCompetitionConfig } from "@/db/schema";

export default function SettingsPage() {
  const config = defaultCompetitionConfig;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Default competition policies. Per-competition overrides live on each competition."
      />
      <div className="space-y-4 rounded-lg border p-4 text-sm">
        <h2 className="font-semibold">Default pairing & ranking policy</h2>
        <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(config, null, 2)}
        </pre>
        <p className="text-muted-foreground">
          Documented in <code>docs/competition-policies.md</code>. Changes to accepted
          results that affect later published draws raise administrator alerts rather than
          silently rewriting history.
        </p>
      </div>
    </div>
  );
}
