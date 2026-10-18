import { PageHeader } from "@/components/page-header";
import { ImporterForm } from "./importer-form";

export default function ImporterSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Importer"
        description="Paste CSV to bulk-create institutions, teams, venues, rooms, or adjudicators"
      />
      <ImporterForm />
    </div>
  );
}
