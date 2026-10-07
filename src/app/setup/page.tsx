import { redirect } from "next/navigation";
import { SetupForm } from "@/components/SetupForm";
import { getWorkspace } from "@/lib/workspace";

export default async function SetupPage() {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  if (workspace.center) redirect("/dashboard");
  return <main className="auth-main" style={{ minHeight: "100vh", background: "#f4f7f1" }}><SetupForm name={workspace.user.name} /></main>;
}
