import { InviteAcceptance } from "@/components/InviteAcceptance";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InviteAcceptance token={token} />;
}
