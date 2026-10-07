export function groupRosterWhere(role: string, userId: string) {
  return role === "TEACHER" ? { learner: { assignedTeacherId: userId } } : {};
}

export function hasExactlyOneTarget(learnerId: unknown, groupId: unknown) {
  return Boolean(learnerId) !== Boolean(groupId);
}

export function hasValidSessionWindow(startsAt: unknown, endsAt: unknown) {
  const start = new Date(String(startsAt)).getTime();
  const end = new Date(String(endsAt)).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

export function teacherCompletionUpdate(data: Record<string, unknown>, completedAt = new Date()): { status: "ASSIGNED" | "COMPLETED"; completedAt: Date | null } | null {
  if (Object.keys(data).some((key) => !["status", "completedAt"].includes(key))) return null;
  if (data.status !== "ASSIGNED" && data.status !== "COMPLETED") return null;
  return { status: data.status, completedAt: data.status === "COMPLETED" ? completedAt : null };
}
