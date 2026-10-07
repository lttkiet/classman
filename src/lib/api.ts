import { CenterRole } from "@prisma/client";
import { db } from "@/lib/db";
import { WorkspaceContext, WorkspaceError } from "@/lib/workspace";
import { canCreateResource, canDeleteResource, canSeeAllCenterRecords, canUpdateResource } from "@/lib/access";
import { ResourceName, resourceSchemas } from "@/lib/validation";
import { groupRosterWhere, hasExactlyOneTarget, hasValidSessionWindow, teacherCompletionUpdate } from "@/lib/scope-rules";

const managerRoles: CenterRole[] = ["OWNER", "MANAGER"];
type Filter = Record<string, unknown>;
type Delegate = {
  findMany(args: Filter): Promise<unknown[]>;
  findFirst(args: Filter): Promise<unknown>;
  create(args: Filter): Promise<unknown>;
  update(args: Filter): Promise<unknown>;
  delete(args: Filter): Promise<unknown>;
};

const delegates: Record<ResourceName, Delegate> = {
  grades: db.grade as unknown as Delegate,
  learners: db.learner as unknown as Delegate,
  groups: db.teachingGroup as unknown as Delegate,
  sessions: db.teachingSession as unknown as Delegate,
  lessons: db.lesson as unknown as Delegate,
  notes: db.lessonNote as unknown as Delegate,
  assignments: db.assignment as unknown as Delegate,
  progress: db.progressUpdate as unknown as Delegate,
};

const teacherScope = (resource: ResourceName, userId: string): Filter => {
  switch (resource) {
    case "grades": return { classes: { some: { learners: { some: { learner: { assignedTeacherId: userId } } } } } };
    case "learners": return { assignedTeacherId: userId };
    case "sessions": return { teacherId: userId };
    case "notes": return { OR: [{ teacherId: userId }, { learner: { assignedTeacherId: userId } }] };
    case "progress": return { OR: [{ teacherId: userId }, { learner: { assignedTeacherId: userId } }] };
    case "assignments": return { OR: [{ learner: { assignedTeacherId: userId } }, { group: { learners: { some: { learner: { assignedTeacherId: userId } } } } }] };
    case "groups": return { learners: { some: { learner: { assignedTeacherId: userId } } } };
    case "lessons": return {};
  }
};

export async function listResource(ctx: WorkspaceContext, resource: ResourceName) {
  const where: Filter = { centerId: ctx.center.id };
  if (!canSeeAllCenterRecords(ctx.membership.role)) Object.assign(where, teacherScope(resource, ctx.user.id));
  return delegates[resource].findMany({
    where,
    orderBy: resource === "sessions" ? { startsAt: "asc" } : { createdAt: "desc" },
    include: resource === "grades" ? { classes: { where: ctx.membership.role === "TEACHER" ? { learners: { some: { learner: { assignedTeacherId: ctx.user.id } } } } : undefined } }
      : resource === "learners" ? { assignedTeacher: { select: { id: true, name: true } }, groupLinks: { include: { group: { include: { grade: true } } } } }
      : resource === "groups" ? { grade: true, learners: { where: groupRosterWhere(ctx.membership.role, ctx.user.id), include: { learner: true } } }
      : resource === "sessions" ? { learner: true, group: true, teacher: { select: { id: true, name: true } } }
      : resource === "notes" ? { learner: true, teacher: { select: { name: true } } }
      : resource === "assignments" ? { learner: true, group: true }
      : resource === "progress" ? { learner: true, teacher: { select: { name: true } } }
      : undefined,
  });
}

export async function createResource(ctx: WorkspaceContext, resource: ResourceName, input: unknown) {
  if (!canCreateResource(ctx.membership.role, resource)) {
    throw new WorkspaceError("Managers are required to create this record.", 403);
  }
  const parsed = resourceSchemas[resource].safeParse(input);
  if (!parsed.success) throw new WorkspaceError(parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  const data = { ...parsed.data } as Record<string, unknown>;
  if ((resource === "sessions" || resource === "assignments") && !hasExactlyOneTarget(data.learnerId, data.groupId)) throw new WorkspaceError("Choose either a student or a class.", 422);
  if (resource === "sessions" && !hasValidSessionWindow(data.startsAt, data.endsAt)) throw new WorkspaceError("End time must be after start time.", 422);
  if (resource === "learners" && ctx.membership.role === "TEACHER") data.assignedTeacherId = ctx.user.id;
  if (resource === "learners" && data.assignedTeacherId) await requireMember(ctx, String(data.assignedTeacherId), "TEACHER");
  if (resource === "groups") await requireGrade(ctx, String(data.gradeId));
  if (resource === "sessions") {
    const teacherId = ctx.membership.role === "TEACHER" ? ctx.user.id : String(data.teacherId ?? "");
    if (!teacherId) throw new WorkspaceError("Choose a teacher from this center.", 422);
    if (teacherId !== ctx.user.id || ctx.membership.role !== "TEACHER") await requireMember(ctx, teacherId);
    data.teacherId = teacherId;
  }
  if (resource === "notes" || resource === "progress") data.teacherId = ctx.user.id;
  if (resource === "assignments") {
    data.completedAt = data.status === "COMPLETED" ? data.completedAt ?? new Date() : null;
  }
  if (resource === "assignments" && data.learnerId) await requireAssignedLearner(ctx, String(data.learnerId));
  if (resource === "sessions") {
    if (data.learnerId) await requireLearner(ctx, String(data.learnerId));
    if (data.groupId) await requireGroup(ctx, String(data.groupId));
    if (ctx.membership.role === "TEACHER" && data.teacherId && data.teacherId !== ctx.user.id) throw new WorkspaceError("You can only assign sessions to yourself.", 403);
  }
  if (resource === "notes" || resource === "progress") await requireAssignedLearner(ctx, String(data.learnerId));
  if (resource === "assignments" && data.groupId) await requireGroup(ctx, String(data.groupId));
  if (resource === "notes") await requireSessionForLearner(ctx, String(data.sessionId ?? ""), String(data.learnerId));
  return delegates[resource].create({ data: { ...data, centerId: ctx.center.id } });
}

export async function getResource(ctx: WorkspaceContext, resource: ResourceName, id: string) {
  const row = await delegates[resource].findFirst({ where: { id, centerId: ctx.center.id, ...scopeFor(ctx, resource) } });
  if (!row) throw new WorkspaceError("Record not found.", 404);
  return row;
}

export async function updateResource(ctx: WorkspaceContext, resource: ResourceName, id: string, input: unknown) {
  const current = await getResource(ctx, resource, id) as Record<string, unknown>;
  if (!canUpdateResource(ctx.membership.role, resource)) throw new WorkspaceError("Managers are required to update this record.", 403);
  if (ctx.membership.role === "TEACHER") {
    if ((resource === "notes" || resource === "progress") && current.teacherId !== ctx.user.id) throw new WorkspaceError("You can only update your own records.", 403);
  }
  const parsed = resourceSchemas[resource].partial().safeParse(input);
  if (!parsed.success) throw new WorkspaceError(parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  const data = { ...parsed.data } as Record<string, unknown>;
  delete data.centerId;
  if (resource === "sessions" || resource === "assignments") {
    const learnerId = Object.hasOwn(data, "learnerId") ? data.learnerId : current.learnerId;
    const groupId = Object.hasOwn(data, "groupId") ? data.groupId : current.groupId;
    if (!hasExactlyOneTarget(learnerId, groupId)) throw new WorkspaceError("Choose either a student or a class.", 422);
  }
  if (resource === "sessions" && !hasValidSessionWindow(data.startsAt ?? current.startsAt, data.endsAt ?? current.endsAt)) {
    throw new WorkspaceError("End time must be after start time.", 422);
  }
  if (resource === "learners" && data.assignedTeacherId) await requireMember(ctx, String(data.assignedTeacherId), "TEACHER");
  if (resource === "groups" && data.gradeId) await requireGrade(ctx, String(data.gradeId));
  if (resource === "sessions") {
    if (data.learnerId) await requireLearner(ctx, String(data.learnerId));
    if (data.groupId) await requireGroup(ctx, String(data.groupId));
    const learnerId = data.learnerId === null ? null : data.learnerId ?? current.learnerId;
    const groupId = data.groupId === null ? null : data.groupId ?? current.groupId;
    if (!learnerId && !groupId) throw new WorkspaceError("Choose a student or class.", 422);
  }
  if ((resource === "notes" || resource === "progress") && data.learnerId) await requireAssignedLearner(ctx, String(data.learnerId));
  if (resource === "sessions" && ctx.membership.role === "TEACHER") {
    if (current.teacherId !== ctx.user.id) throw new WorkspaceError("You can only update your own sessions.", 403);
    const teacherFields = new Set(["title", "learnerId", "groupId", "startsAt", "endsAt", "status", "attendance", "location"]);
    if (Object.keys(data).some((key) => !teacherFields.has(key))) throw new WorkspaceError("Teachers cannot reassign a session to another staff member.", 403);
  }
  if (resource === "sessions" && ctx.membership.role !== "TEACHER" && Object.hasOwn(data, "teacherId")) {
    if (!data.teacherId) throw new WorkspaceError("Choose a teacher from this center.", 422);
    await requireMember(ctx, String(data.teacherId));
  }
  if (resource === "notes") {
    const sessionId = data.sessionId === undefined ? current.sessionId : data.sessionId;
    const learnerId = data.learnerId === undefined ? current.learnerId : data.learnerId;
    if (sessionId) await requireSessionForLearner(ctx, String(sessionId), String(learnerId));
  }
  if (resource === "assignments") {
    if (data.learnerId) await requireAssignedLearner(ctx, String(data.learnerId));
    if (data.groupId) await requireGroup(ctx, String(data.groupId));
    if (ctx.membership.role === "TEACHER") {
      const completion = teacherCompletionUpdate(data);
      if (!completion) throw new WorkspaceError("Teachers can update assignment completion only.", 403);
      return db.assignment.update({ where: { id }, data: completion });
    }
    if (data.status !== undefined) data.completedAt = data.status === "COMPLETED" ? data.completedAt ?? new Date() : null;
  }
  if (resource === "learners" && Object.hasOwn(data, "assignedTeacherId") && data.assignedTeacherId !== current.assignedTeacherId) {
    return db.$transaction(async (tx) => {
      const learner = await tx.learner.update({ where: { id }, data });
      await tx.transferRequest.updateMany({ where: { centerId: ctx.center.id, learnerId: id, status: "PENDING" }, data: { status: "CANCELLED", respondedAt: new Date(), responseMessage: "Cancelled because the student assignment was changed by a manager." } });
      return learner;
    });
  }
  return delegates[resource].update({ where: { id }, data });
}

export async function deleteResource(ctx: WorkspaceContext, resource: ResourceName, id: string) {
  await getResource(ctx, resource, id);
  if (!canDeleteResource(ctx.membership.role)) throw new WorkspaceError("Managers are required to delete records.", 403);
  if (resource === "groups") {
    return db.$transaction(async (tx) => {
      await tx.libraryDocument.updateMany({ where: { centerId: ctx.center.id, scope: "CLASS", groupId: id }, data: { scope: "COMMON", groupId: null } });
      return tx.teachingGroup.delete({ where: { id } });
    });
  }
  if (resource === "grades" && await db.teachingGroup.count({ where: { centerId: ctx.center.id, gradeId: id } })) {
    throw new WorkspaceError("Move or delete this grade’s classes before deleting the grade.", 409);
  }
  if (resource === "grades") {
    return db.$transaction(async (tx) => {
      await tx.libraryDocument.updateMany({ where: { centerId: ctx.center.id, scope: "GRADE", gradeId: id }, data: { scope: "COMMON", gradeId: null } });
      return tx.grade.delete({ where: { id } });
    });
  }
  return delegates[resource].delete({ where: { id } });
}

async function requireGrade(ctx: WorkspaceContext, gradeId: string) {
  const grade = await db.grade.findFirst({ where: { id: gradeId, centerId: ctx.center.id, status: "ACTIVE" } });
  if (!grade) throw new WorkspaceError("Choose an active grade from this center.", 422);
}

export async function requireMember(ctx: WorkspaceContext, userId: string, role?: CenterRole) {
  const member = await db.membership.findFirst({ where: { centerId: ctx.center.id, userId } });
  if (!member || (role && member.role !== role)) throw new WorkspaceError("Choose a teacher from this center.", 422);
}

async function requireSessionForLearner(ctx: WorkspaceContext, sessionId: string, learnerId: string) {
  if (!sessionId) return;
  const session = await db.teachingSession.findFirst({
    where: { id: sessionId, centerId: ctx.center.id, ...(ctx.membership.role === "TEACHER" ? { teacherId: ctx.user.id } : {}) },
    select: { learnerId: true, groupId: true },
  });
  if (!session) throw new WorkspaceError("Session not found in this center.", 404);
  if (session.learnerId === learnerId) return;
  if (session.groupId && await db.groupLearner.findUnique({ where: { groupId_learnerId: { groupId: session.groupId, learnerId } }, select: { groupId: true } })) return;
  throw new WorkspaceError("The session does not include this student.", 422);
}

export async function requireAssignedLearner(ctx: WorkspaceContext, learnerId: string) {
  const learner = await db.learner.findFirst({ where: { id: learnerId, centerId: ctx.center.id } });
  if (!learner) throw new WorkspaceError("Student not found in this center.", 404);
  if (ctx.membership.role === "TEACHER" && learner.assignedTeacherId !== ctx.user.id) throw new WorkspaceError("This student is not assigned to you.", 403);
}

async function requireLearner(ctx: WorkspaceContext, learnerId: string) {
  const learner = await db.learner.findFirst({ where: { id: learnerId, centerId: ctx.center.id } });
  if (!learner) throw new WorkspaceError("Student not found in this center.", 404);
  if (ctx.membership.role === "TEACHER" && learner.assignedTeacherId !== ctx.user.id) throw new WorkspaceError("This student is not assigned to you.", 403);
}

async function requireGroup(ctx: WorkspaceContext, groupId: string) {
  const group = await db.teachingGroup.findFirst({ where: { id: groupId, centerId: ctx.center.id } });
  if (!group) throw new WorkspaceError("Class not found in this center.", 404);
  if (ctx.membership.role === "TEACHER") {
    const visible = await db.groupLearner.findFirst({ where: { groupId, learner: { assignedTeacherId: ctx.user.id } } });
    if (!visible) throw new WorkspaceError("This class has no students assigned to you.", 403);
  }
}

function scopeFor(ctx: WorkspaceContext, resource: ResourceName): Filter {
  return ctx.membership.role === "TEACHER" ? teacherScope(resource, ctx.user.id) : {};
}

export function isResourceName(value: string): value is ResourceName {
  return Object.hasOwn(resourceSchemas, value);
}

export async function updateCenterRole(ctx: WorkspaceContext, userId: string, role: CenterRole) {
  if (!managerRoles.includes(ctx.membership.role)) throw new WorkspaceError("Managers are required to manage staff.", 403);
  const target = await db.membership.findFirst({ where: { centerId: ctx.center.id, userId } });
  if (!target) throw new WorkspaceError("Staff member not found.", 404);
  if (target.role === "OWNER") throw new WorkspaceError("The owner role cannot be changed here.", 403);
  return db.membership.update({ where: { id: target.id }, data: { role } });
}

export async function centerStaff(ctx: WorkspaceContext) {
  if (!managerRoles.includes(ctx.membership.role)) throw new WorkspaceError("Managers are required to view staff.", 403);
  return db.membership.findMany({ where: { centerId: ctx.center.id }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } });
}

export async function removeStaff(ctx: WorkspaceContext, userId: string) {
  if (!managerRoles.includes(ctx.membership.role)) throw new WorkspaceError("Managers are required to manage staff.", 403);
  const target = await db.membership.findFirst({ where: { centerId: ctx.center.id, userId } });
  if (!target) throw new WorkspaceError("Staff member not found.", 404);
  if (target.role === "OWNER" || target.userId === ctx.user.id) throw new WorkspaceError("The owner cannot be removed.", 403);
  await db.membership.delete({ where: { id: target.id } });
}

export async function addGroupLearner(ctx: WorkspaceContext, groupId: string, learnerId: string) {
  if (!managerRoles.includes(ctx.membership.role)) throw new WorkspaceError("Managers are required to manage class rosters.", 403);
  await requireGroup(ctx, groupId);
  const learner = await db.learner.findFirst({ where: { id: learnerId, centerId: ctx.center.id } });
  if (!learner) throw new WorkspaceError("Student not found in this center.", 404);
  return db.groupLearner.upsert({ where: { groupId_learnerId: { groupId, learnerId } }, create: { groupId, learnerId }, update: {} });
}

export async function removeGroupLearner(ctx: WorkspaceContext, groupId: string, learnerId: string) {
  if (!managerRoles.includes(ctx.membership.role)) throw new WorkspaceError("Managers are required to manage class rosters.", 403);
  await requireGroup(ctx, groupId);
  await db.groupLearner.deleteMany({ where: { groupId, learnerId } });
}

export async function validateInvitation(ctx: WorkspaceContext, tokenHash: string) {
  return db.invitation.findFirst({ where: { centerId: ctx.center.id, tokenHash, acceptedAt: null, expiresAt: { gt: new Date() } } });
}

export function assertCanManage(ctx: WorkspaceContext) {
  if (!managerRoles.includes(ctx.membership.role)) throw new WorkspaceError("Managers are required to manage this center.", 403);
}
