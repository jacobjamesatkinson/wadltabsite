import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getSiteCompetition } from "@/lib/competition";

export default async function SettingsPage() {
  const competition = await getSiteCompetition();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Competitions"
        description="Site competition settings. Manage rounds and divisions from the Settings menu."
      />
      {competition ? (
        <div className="space-y-4 border p-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Name
              </p>
              <p className="font-medium">{competition.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Season
              </p>
              <p className="font-medium">{competition.season}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Short name
              </p>
              <p className="font-medium">{competition.shortName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              <p className="font-medium">{competition.status}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Link
              href="/admin/settings/rounds"
              className="border px-3 py-2 text-sm hover:bg-muted"
            >
              Manage Rounds
            </Link>
            <Link
              href="/admin/settings/divisions"
              className="border px-3 py-2 text-sm hover:bg-muted"
            >
              Manage Divisions
            </Link>
          </div>
          <div>
            <h2 className="mb-2 font-semibold">Pairing & ranking policy</h2>
            <pre className="overflow-auto bg-muted p-3 text-xs">
              {JSON.stringify(competition.config, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="border p-4 text-sm text-muted-foreground">
          No competition has been seeded yet. Run <code>pnpm db:setup</code> to
          create the site competition.
        </div>
      )}
    </div>
  );
}
