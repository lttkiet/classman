import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { WorkspaceError } from "@/lib/workspace";

type RouteContext = { params: Promise<{ token: string }> };
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { token } = await params;
    const invitation = await db.invitation.findFirst({ where: { tokenHash: hashToken(token), acceptedAt: null, expiresAt: { gt: new Date() } }, include: { center: { select: { name: true } } } });
    if (!invitation) throw new WorkspaceError("This invitation is invalid or has expired.", 404);
    return NextResponse.json({ data: { email: invitation.email, role: invitation.role, centerName: invitation.center.name } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new WorkspaceError("Sign in before accepting this invitation.", 401);
    const { token } = await params;
    const tokenHash = hashToken(token);
    const invitation = await db.invitation.findFirst({ where: { tokenHash, acceptedAt: null, expiresAt: { gt: new Date() } } });
    if (!invitation) throw new WorkspaceError("This invitation is invalid or has expired.", 404);
    if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) throw new WorkspaceError("Sign in with the email address this invitation was sent to.", 403);
    const existingMembership = await db.membership.findUnique({ where: { userId: session.user.id } });
    if (existingMembership) throw new WorkspaceError("This account already belongs to a center.", 409);
    await db.$transaction(async (tx) => {
      const accepted = await tx.invitation.updateMany({ where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
      if (!accepted.count) throw new WorkspaceError("This invitation is invalid or has expired.", 404);
      await tx.membership.create({ data: { centerId: invitation.centerId, userId: session.user.id, role: invitation.role } });
    });
    return NextResponse.json({ data: { accepted: true, centerId: invitation.centerId } });
  } catch (error) {
    return jsonError(error);
  }
}
