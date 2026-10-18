import { normalizeCompetitionConfig } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { ensureSiteCompetition } from "@/lib/competition";
import {
  CompetitionRulesForm,
  GeneralSettingsForm,
  GenerateAllTeamLinksForm,
} from "./general-settings-form";

export default async function GeneralSettingsPage() {
  const competition = await ensureSiteCompetition();

  return (
    <div className="space-y-8">
      <PageHeader
        title="General"
        description="Site-wide settings for this competition"
      />
      <GeneralSettingsForm competitionName={competition.name} />
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Team access</h2>
        <GenerateAllTeamLinksForm />
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Competition rules</h2>
        <CompetitionRulesForm
          competitionId={competition.id}
          config={normalizeCompetitionConfig(competition.config)}
        />
      </section>
    </div>
  );
}
