import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { createTransfer, createTransferSchema, listTransfers } from "@/lib/transfers";
import { requireWorkspace } from "@/lib/workspace";

export async function GET() {
  try {
    return NextResponse.json({ data: await listTransfers(await requireWorkspace()) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspace();
    const parsed = createTransferSchema.safeParse(await readJson(request));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid transfer request." }, { status: 422 });
    return NextResponse.json({ data: await createTransfer(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
