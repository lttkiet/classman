import { headers } from "next/headers";
import { CenterRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getWorkspace() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const membership = await db.membership.findUnique({ where: { userId: session.user.id }, include: { center: true } });
  if (!membership) return { user: session.user, membership: null, center: null };
  return { user: session.user, membership, center: membership.center };
}

export type WorkspaceContext = NonNullable<Awaited<ReturnType<typeof getWorkspace>>> & {
  membership: NonNullable<NonNullable<Awaited<ReturnType<typeof getWorkspace>>>["membership"]>;
  center: NonNullable<NonNullable<Awaited<ReturnType<typeof getWorkspace>>>["center"]>;
};

export async function requireWorkspace(roles?: CenterRole[]) {
  const workspace = await getWorkspace();
  if (!workspace?.membership || !workspace.center) throw new WorkspaceError("A center workspace is required.", 403);
  if (roles && !roles.includes(workspace.membership.role)) throw new WorkspaceError("You do not have permission to do that.", 403);
  return workspace as WorkspaceContext;
}

export class WorkspaceError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
