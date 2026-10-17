import { redirect } from "next/navigation";

export default async function RoundIndexPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  redirect(`/admin/rounds/${roundId}/availability`);
}
