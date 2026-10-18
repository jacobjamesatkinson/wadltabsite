import { redirect } from "next/navigation";

export default async function TeamPortalIndexPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/team/${token}/draw`);
}
