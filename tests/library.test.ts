import assert from "node:assert/strict";
import test from "node:test";
import { libraryVisibilityWhere } from "../src/lib/library-access.ts";
import { libraryDocumentSchema } from "../src/lib/validation.ts";

test("teachers see common documents and documents scoped to their assigned classes", () => {
  assert.deepEqual(libraryVisibilityWhere("TEACHER", "teacher-1"), {
    OR: [
      { scope: "COMMON" },
      { scope: "GRADE", grade: { classes: { some: { learners: { some: { learner: { assignedTeacherId: "teacher-1" } } } } } } },
      { scope: "CLASS", group: { learners: { some: { learner: { assignedTeacherId: "teacher-1" } } } } },
    ],
  });
});

test("managers can view the entire center library", () => {
  assert.deepEqual(libraryVisibilityWhere("MANAGER", "manager-1"), {});
});

test("library scope requires exactly its grade or class target", () => {
  const base = { title: "Reading pack", description: "Week one" };
  assert.equal(libraryDocumentSchema.safeParse({ ...base, scope: "COMMON" }).success, true);
  assert.equal(libraryDocumentSchema.safeParse({ ...base, scope: "GRADE", gradeId: "grade-1" }).success, true);
  assert.equal(libraryDocumentSchema.safeParse({ ...base, scope: "CLASS", groupId: "class-1" }).success, true);
  assert.equal(libraryDocumentSchema.safeParse({ ...base, scope: "GRADE", groupId: "class-1" }).success, false);
  assert.equal(libraryDocumentSchema.safeParse({ ...base, scope: "COMMON", gradeId: "grade-1" }).success, false);
});
