import { redirect } from "next/navigation";

/** Legacy URL — public draw is now the site home. */
export default async function PublicDrawRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.round) params.set("round", sp.round);
  const qs = params.toString();
  redirect(qs ? `/?${qs}` : "/");
}
