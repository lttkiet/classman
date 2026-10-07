import { CenterRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { removeStaff, updateCenterRole } from "@/lib/api";
import { jsonError, readJson } from "@/lib/http";
import { requireWorkspace } from "@/lib/workspace";
import { z } from "zod";

type RouteContext = { params: Promise<{ userId: string }> };
const roleSchema = z.object({ role: z.enum(["MANAGER", "TEACHER"]) });

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { userId } = await params;
    const parsed = roleSchema.safeParse(await readJson(request));
    if (!parsed.success) return NextResponse.json({ error: "Choose manager or teacher." }, { status: 422 });
    return NextResponse.json({ data: await updateCenterRole(await requireWorkspace(), userId, parsed.data.role as CenterRole) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { userId } = await params;
    await removeStaff(await requireWorkspace(), userId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
