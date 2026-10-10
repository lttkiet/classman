import { CenterRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { libraryVisibilityWhere } from "@/lib/library-access";
import { libraryDocumentSchema } from "@/lib/validation";
import { requireWorkspace, WorkspaceError } from "@/lib/workspace";
import sanitize from "sanitize-filename";

const maxFileSize = 15 * 1024 * 1024;
const allowedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const typeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET() {
  try {
    const ctx = await requireWorkspace();
    const documents = await db.libraryDocument.findMany({
      where: { centerId: ctx.center.id, ...libraryVisibilityWhere(ctx.membership.role, ctx.user.id) },
      select: {
        id: true, scope: true, title: true, description: true, fileName: true,
        contentType: true, size: true, createdAt: true,
        grade: { select: { id: true, name: true } },
        group: { select: { id: true, name: true, grade: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    const [grades, classes] = ctx.membership.role === CenterRole.TEACHER
      ? [[], []]
      : await Promise.all([
        db.grade.findMany({ where: { centerId: ctx.center.id, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
        db.teachingGroup.findMany({ where: { centerId: ctx.center.id, status: "ACTIVE" }, select: { id: true, name: true, grade: { select: { name: true } } }, orderBy: { name: "asc" } }),
      ]);
    return NextResponse.json({ data: { documents, grades, classes } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspace([CenterRole.OWNER, CenterRole.MANAGER]);
    const form = await request.formData();
    const parsed = libraryDocumentSchema.safeParse({
      title: form.get("title"),
      description: form.get("description") || undefined,
      scope: form.get("scope"),
      gradeId: form.get("gradeId") || undefined,
      groupId: form.get("groupId") || undefined,
    });
    if (!parsed.success) throw new WorkspaceError(parsed.error.issues[0]?.message ?? "Invalid document details.", 422);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new WorkspaceError("Choose a document to upload.", 422);
    if (file.size > maxFileSize) throw new WorkspaceError("Files must be 15 MB or smaller.", 413);
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const contentType = !file.type || file.type === "application/octet-stream" ? typeByExtension[extension] ?? file.type : file.type;
    if (!allowedTypes.has(contentType)) throw new WorkspaceError("Use a PDF, Word, PowerPoint, text, or image file.", 415);

    if (parsed.data.scope === "GRADE") {
      const grade = await db.grade.findFirst({ where: { id: parsed.data.gradeId, centerId: ctx.center.id, status: "ACTIVE" }, select: { id: true } });
      if (!grade) throw new WorkspaceError("Choose an active grade from this center.", 422);
    }
    if (parsed.data.scope === "CLASS") {
      const group = await db.teachingGroup.findFirst({ where: { id: parsed.data.groupId, centerId: ctx.center.id, status: "ACTIVE" }, select: { id: true } });
      if (!group) throw new WorkspaceError("Choose an active class from this center.", 422);
    }

    const document = await db.libraryDocument.create({
      data: {
        centerId: ctx.center.id,
        uploadedById: ctx.user.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        scope: parsed.data.scope,
        gradeId: parsed.data.scope === "GRADE" ? parsed.data.gradeId : null,
        groupId: parsed.data.scope === "CLASS" ? parsed.data.groupId : null,
        fileName: (sanitize(file.name) || "document").slice(0, 240),
        contentType,
        size: file.size,
        content: new Uint8Array(await file.arrayBuffer()),
      },
      select: { id: true, title: true },
    });
    return NextResponse.json({ data: document }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
