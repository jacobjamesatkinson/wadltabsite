import { redirect } from "next/navigation";

export default function CompetitionDetailRedirect() {
  redirect("/admin/settings");
}
