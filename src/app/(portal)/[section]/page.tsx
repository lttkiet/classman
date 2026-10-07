import { notFound } from "next/navigation";
import { WorkspacePage } from "@/components/WorkspacePage";
import { TransferPage } from "@/components/TransferPage";
import { LibraryPage } from "@/components/LibraryPage";
import { requireWorkspace } from "@/lib/workspace";

const sections = ["grades", "learners", "groups", "schedule", "lessons", "library", "notes", "assignments", "progress", "transfers", "team", "settings"];

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  const ctx = await requireWorkspace();
  if ((section === "team" || section === "settings") && ctx.membership.role === "TEACHER") notFound();
  if (section === "transfers") return <TransferPage role={ctx.membership.role} userId={ctx.user.id} />;
  if (section === "library") return <LibraryPage role={ctx.membership.role} />;
  return <WorkspacePage section={section} role={ctx.membership.role} />;
}
