import { NextResponse } from "next/server";
import { deleteResource, getResource, isResourceName, updateResource } from "@/lib/api";
import { jsonError, readJson } from "@/lib/http";
import { requireWorkspace } from "@/lib/workspace";

type RouteContext = { params: Promise<{ resource: string; id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { resource, id } = await params;
    if (!isResourceName(resource)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    return NextResponse.json({ data: await getResource(await requireWorkspace(), resource, id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { resource, id } = await params;
    if (!isResourceName(resource)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    const data = await updateResource(await requireWorkspace(), resource, id, await readJson(request));
    return NextResponse.json({ data });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { resource, id } = await params;
    if (!isResourceName(resource)) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
    await deleteResource(await requireWorkspace(), resource, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
