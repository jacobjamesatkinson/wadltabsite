import { redirect } from "next/navigation";
import { getSiteRounds } from "@/lib/competition";

export default async function ResultsRedirectPage() {
  const rounds = await getSiteRounds();
  if (rounds[0]) {
    redirect(`/admin/rounds/${rounds[0].id}/results`);
  }
  redirect("/admin");
}
