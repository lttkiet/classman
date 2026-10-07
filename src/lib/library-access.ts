import type { CenterRole, Prisma } from "@prisma/client";

export function libraryVisibilityWhere(role: CenterRole, userId: string): Prisma.LibraryDocumentWhereInput {
  if (role !== "TEACHER") return {};
  const assignedLearners = { some: { learner: { assignedTeacherId: userId } } };
  return {
    OR: [
      { scope: "COMMON" },
      { scope: "GRADE", grade: { classes: { some: { learners: assignedLearners } } } },
      { scope: "CLASS", group: { learners: assignedLearners } },
    ],
  };
}
