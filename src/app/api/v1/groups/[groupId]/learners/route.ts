import { NextResponse } from "next/server";
import { addGroupLearner, removeGroupLearner } from "@/lib/api";
import { db } from "@/lib/db";
import { jsonError, readJson } from "@/lib/http";
import { requireWorkspace, WorkspaceError } from "@/lib/workspace";
import { groupRosterWhere } from "@/lib/scope-rules";
import { z } from "zod";

type RouteContext = { params: Promise<{ groupId: string }> };
const learnerSchema = z.object({ learnerId: z.string().min(1) });

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const ctx = await requireWorkspace();
    const { groupId } = await params;
    const group = await db.teachingGroup.findFirst({ where: { id: groupId, centerId: ctx.center.id }, include: { learners: { where: groupRosterWhere(ctx.membership.role, ctx.user.id), include: { learner: true } } } });
    if (!group) throw new WorkspaceError("Group not found.", 404);
    if (ctx.membership.role === "TEACHER" && !group.learners.length) throw new WorkspaceError("This class is not assigned to you.", 403);
    return NextResponse.json({ data: group.learners.map((item) => item.learner) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const parsed = learnerSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new WorkspaceError("Choose a student.", 422);
    const { groupId } = await params;
    return NextResponse.json({ data: await addGroupLearner(await requireWorkspace(), groupId, parsed.data.learnerId) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { searchParams } = new URL(request.url);
    const learnerId = searchParams.get("learnerId");
    if (!learnerId) throw new WorkspaceError("Choose a student.", 422);
    const { groupId } = await params;
    await removeGroupLearner(await requireWorkspace(), groupId, learnerId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
