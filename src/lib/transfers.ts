import { z } from "zod";
import { db } from "@/lib/db";
import { WorkspaceContext, WorkspaceError } from "@/lib/workspace";

export const createTransferSchema = z.object({
  learnerId: z.string().min(1),
  targetTeacherId: z.string().min(1),
  message: z.string().trim().max(500).optional(),
});

export const respondTransferSchema = z.object({
  action: z.enum(["accept", "decline", "cancel"]),
  responseMessage: z.string().trim().max(500).optional(),
});

const transferInclude = {
  learner: { select: { id: true, name: true, level: true } },
  requester: { select: { id: true, name: true } },
  targetTeacher: { select: { id: true, name: true } },
} as const;

export async function listTransfers(ctx: WorkspaceContext) {
  const where = ctx.membership.role === "TEACHER"
    ? { centerId: ctx.center.id, OR: [{ requesterId: ctx.user.id }, { targetTeacherId: ctx.user.id }] }
    : { centerId: ctx.center.id };
  const [requests, learners, teachers] = await Promise.all([
    db.transferRequest.findMany({ where, include: transferInclude, orderBy: { createdAt: "desc" } }),
    ctx.membership.role === "TEACHER"
      ? db.learner.findMany({
        where: { centerId: ctx.center.id, assignedTeacherId: ctx.user.id, status: "ACTIVE", transferRequests: { none: { status: "PENDING" } } },
        select: { id: true, name: true, level: true }, orderBy: { name: "asc" },
      })
      : Promise.resolve([]),
    ctx.membership.role === "TEACHER"
      ? db.membership.findMany({
        where: { centerId: ctx.center.id, role: "TEACHER", userId: { not: ctx.user.id } },
        select: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" },
      })
      : Promise.resolve([]),
  ]);
  return { requests, learners, teachers: teachers.map(({ user }) => user) };
}

export async function createTransfer(ctx: WorkspaceContext, input: z.infer<typeof createTransferSchema>) {
  if (ctx.membership.role !== "TEACHER") throw new WorkspaceError("Only teachers can request a student transfer.", 403);
  const [learner, target] = await Promise.all([
    db.learner.findFirst({ where: { id: input.learnerId, centerId: ctx.center.id, assignedTeacherId: ctx.user.id, status: "ACTIVE" } }),
    db.membership.findFirst({ where: { centerId: ctx.center.id, userId: input.targetTeacherId, role: "TEACHER" } }),
  ]);
  if (!learner) throw new WorkspaceError("This student is not actively assigned to you.", 404);
  if (!target || input.targetTeacherId === ctx.user.id) throw new WorkspaceError("Choose another teacher from your center.", 422);
  const pending = await db.transferRequest.findFirst({ where: { centerId: ctx.center.id, learnerId: learner.id, status: "PENDING" } });
  if (pending) throw new WorkspaceError("This student already has a pending transfer request.", 409);
  return db.transferRequest.create({
    data: { centerId: ctx.center.id, learnerId: learner.id, requesterId: ctx.user.id, targetTeacherId: target.userId, message: input.message || null },
    include: transferInclude,
  });
}

export async function respondToTransfer(ctx: WorkspaceContext, id: string, input: z.infer<typeof respondTransferSchema>) {
  if (ctx.membership.role !== "TEACHER") throw new WorkspaceError("Only the teachers involved can respond to a transfer.", 403);
  const request = await db.transferRequest.findFirst({ where: { id, centerId: ctx.center.id } });
  if (!request) throw new WorkspaceError("Transfer request not found.", 404);
  const now = new Date();
  if (input.action === "cancel") {
    if (request.requesterId !== ctx.user.id) throw new WorkspaceError("Only the requesting teacher can cancel this request.", 403);
    const result = await db.transferRequest.updateMany({ where: { id, centerId: ctx.center.id, requesterId: ctx.user.id, status: "PENDING" }, data: { status: "CANCELLED", respondedAt: now, responseMessage: input.responseMessage || null } });
    if (!result.count) throw new WorkspaceError("This request is no longer pending.", 409);
  } else {
    if (request.targetTeacherId !== ctx.user.id) throw new WorkspaceError("Only the target teacher can respond to this request.", 403);
    if (input.action === "accept") {
      await db.$transaction(async (tx) => {
        const currentLearner = await tx.learner.updateMany({
          where: { id: request.learnerId, centerId: ctx.center.id, assignedTeacherId: request.requesterId, status: "ACTIVE" },
          data: { assignedTeacherId: ctx.user.id },
        });
        if (!currentLearner.count) throw new WorkspaceError("The student’s assignment changed. This request can no longer be accepted.", 409);
        await tx.teachingSession.updateMany({
          where: { centerId: ctx.center.id, learnerId: request.learnerId, teacherId: request.requesterId, status: "SCHEDULED", startsAt: { gt: now } },
          data: { teacherId: ctx.user.id },
        });
        const updated = await tx.transferRequest.updateMany({ where: { id, centerId: ctx.center.id, targetTeacherId: ctx.user.id, status: "PENDING" }, data: { status: "ACCEPTED", respondedAt: now, responseMessage: input.responseMessage || null } });
        if (!updated.count) throw new WorkspaceError("This request is no longer pending.", 409);
      });
    } else {
      const result = await db.transferRequest.updateMany({ where: { id, centerId: ctx.center.id, targetTeacherId: ctx.user.id, status: "PENDING" }, data: { status: "DECLINED", respondedAt: now, responseMessage: input.responseMessage || null } });
      if (!result.count) throw new WorkspaceError("This request is no longer pending.", 409);
    }
  }
  return db.transferRequest.findFirst({ where: { id, centerId: ctx.center.id }, include: transferInclude });
}
