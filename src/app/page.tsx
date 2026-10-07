import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";

export default async function HomePage() {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  redirect(workspace.center ? "/dashboard" : "/setup");
}
