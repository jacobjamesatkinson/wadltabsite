import { redirect } from "next/navigation";
import { getSiteRounds } from "@/lib/competition";

/** Legacy draws index — round workflow lives under /admin/rounds. */
export default async function DrawsRedirectPage() {
  const rounds = await getSiteRounds();
  if (rounds[0]) {
    redirect(`/admin/rounds/${rounds[0].id}/draw`);
  }
  redirect("/admin");
}
