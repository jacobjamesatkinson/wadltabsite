import { redirect } from "next/navigation";

/** Multi-competition UI removed — site has a single competition under Settings. */
export default function CompetitionsRedirectPage() {
  redirect("/admin/settings");
}
