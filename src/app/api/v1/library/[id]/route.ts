import { CenterRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attachmentDisposition } from "@/lib/download";
import { jsonError } from "@/lib/http";
import { libraryVisibilityWhere } from "@/lib/library-access";
import { requireWorkspace, WorkspaceError } from "@/lib/workspace";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const ctx = await requireWorkspace([CenterRole.OWNER, CenterRole.MANAGER]);
    const { id } = await params;
    const document = await db.libraryDocument.findFirst({ where: { id, centerId: ctx.center.id }, select: { id: true } });
    if (!document) throw new WorkspaceError("Document not found.", 404);
    await db.libraryDocument.delete({ where: { id: document.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const ctx = await requireWorkspace();
    const { id } = await params;
    const document = await db.libraryDocument.findFirst({
      where: { id, centerId: ctx.center.id, ...libraryVisibilityWhere(ctx.membership.role, ctx.user.id) },
      select: { fileName: true, contentType: true, content: true },
    });
    if (!document) throw new WorkspaceError("Document not found.", 404);
    return new Response(new Uint8Array(document.content), {
      headers: {
        "Content-Type": document.contentType,
        "Content-Length": String(document.content.byteLength),
        "Content-Disposition": attachmentDisposition(document.fileName),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
