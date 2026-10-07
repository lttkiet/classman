import assert from "node:assert/strict";
import test from "node:test";
import { resourceSchemas } from "../src/lib/validation.ts";

test("validates learner records and rejects incomplete names", () => {
  assert.equal(resourceSchemas.learners.safeParse({ name: "Ari Nguyen", email: "ari@example.test" }).success, true);
  assert.equal(resourceSchemas.learners.safeParse({ name: "A" }).success, false);
});

test("grades contain classes and every class selects a grade", () => {
  assert.equal(resourceSchemas.grades.safeParse({ name: "Grade 6" }).success, true);
  assert.equal(resourceSchemas.grades.safeParse({ name: "" }).success, false);
  assert.equal(resourceSchemas.groups.safeParse({ name: "6A", gradeId: "grade-6" }).success, true);
  assert.equal(resourceSchemas.groups.safeParse({ name: "6A" }).success, false);
});

test("validates session timestamps and attendance updates", () => {
  const valid = { title: "Conversation practice", learnerId: "learner-1", startsAt: "2026-10-06T03:00:00.000Z", endsAt: "2026-10-06T04:00:00.000Z", attendance: "PRESENT" };
  assert.equal(resourceSchemas.sessions.safeParse(valid).success, true);
  assert.equal(resourceSchemas.sessions.partial().safeParse({ attendance: "LATE" }).success, true);
});

test("validates assignment state and progress score bounds", () => {
  assert.equal(resourceSchemas.assignments.safeParse({ title: "Read chapter", learnerId: "learner-1", status: "ASSIGNED" }).success, true);
  assert.equal(resourceSchemas.progress.safeParse({ learnerId: "learner-1", subject: "Speaking", score: 110 }).success, false);
});
