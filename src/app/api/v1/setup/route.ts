import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, readJson } from "@/lib/http";
import { centerSchema } from "@/lib/validation";
import { headers } from "next/headers";
import { WorkspaceError } from "@/lib/workspace";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const membership = await db.membership.findUnique({ where: { userId: session.user.id }, include: { center: true } });
  return NextResponse.json({ hasCenter: Boolean(membership), center: membership?.center ?? null });
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new WorkspaceError("Sign in required.", 401);
    const parsed = centerSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new WorkspaceError(parsed.error.issues[0]?.message ?? "Invalid center name.", 422);
    const [existing, existingCenter] = await Promise.all([
      db.membership.findUnique({ where: { userId: session.user.id } }),
      db.center.findFirst({ select: { id: true } }),
    ]);
    if (existing) throw new WorkspaceError("This account already belongs to a center.", 409);
    if (existingCenter) throw new WorkspaceError("A center already exists. Ask its administrator for an invitation.", 409);
    const center = await db.$transaction(async (tx) => {
      const created = await tx.center.create({ data: { name: parsed.data.name } });
      await tx.membership.create({ data: { centerId: created.id, userId: session.user.id, role: "OWNER" } });
      return created;
    });
    return NextResponse.json({ center }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
