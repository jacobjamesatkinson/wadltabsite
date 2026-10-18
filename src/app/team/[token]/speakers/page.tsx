import { PageHeader } from "@/components/page-header";
import { loadTeamPortal, loadTeamPortalSpeakers } from "@/lib/team-portal/load";
import { SpeakersPanel } from "./speakers-panel";

export default async function TeamPortalSpeakersPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await loadTeamPortal(token);
  const speakers = await loadTeamPortalSpeakers(ctx.team.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Speakers"
        description="Add speakers freely. Removing someone who already appears on a ballot needs admin approval."
      />
      <div className="max-w-xl">
        <SpeakersPanel
          token={token}
          speakers={speakers}
          canEdit={ctx.canEditSpeakers}
        />
      </div>
    </div>
  );
}
