import { redirect } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { getWorkspace } from "@/lib/workspace";

export default async function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  if (!workspace.center || !workspace.membership) redirect("/setup");
  return <PortalShell userName={workspace.user.name} centerName={workspace.center.name} role={workspace.membership.role}>{children}</PortalShell>;
}
