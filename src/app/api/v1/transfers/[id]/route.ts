import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { respondToTransfer, respondTransferSchema } from "@/lib/transfers";
import { requireWorkspace } from "@/lib/workspace";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const ctx = await requireWorkspace();
    const { id } = await params;
    const parsed = respondTransferSchema.safeParse(await readJson(request));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid response." }, { status: 422 });
    return NextResponse.json({ data: await respondToTransfer(ctx, id, parsed.data) });
  } catch (error) {
    return jsonError(error);
  }
}
