import { NextResponse } from "next/server";
import { createResource, isResourceName, listResource } from "@/lib/api";
import { jsonError, readJson } from "@/lib/http";
import { requireWorkspace } from "@/lib/workspace";

type RouteContext = { params: Promise<{ resource: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { resource } = await params;
    if (!isResourceName(resource)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    return NextResponse.json({ data: await listResource(await requireWorkspace(), resource) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { resource } = await params;
    if (!isResourceName(resource)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    const record = await createResource(await requireWorkspace(), resource, await readJson(request));
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
