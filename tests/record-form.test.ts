import assert from "node:assert/strict";
import test from "node:test";
import { recordPayload } from "../src/lib/record-form.ts";
import { resourceSchemas } from "../src/lib/validation.ts";

test("teacher session edits send editable fields without reassignment or relations", () => {
  const payload = recordPayload("sessions", {
    id: "session-1", teacherId: "teacher-1", teacher: { name: "Teacher" },
    title: "Conversation", learnerId: "learner-1", groupId: "", attendance: "PRESENT",
    startsAt: "2026-10-10T10:00", endsAt: "2026-10-10T11:00", location: null,
  }, [...["title", "learnerId", "groupId", "attendance", "location"].map((name) => ({ name })),
    { name: "startsAt", kind: "datetime-local" }, { name: "endsAt", kind: "datetime-local" },
  ], true);
  assert.equal(Object.hasOwn(payload, "teacherId"), false);
  assert.equal(Object.hasOwn(payload, "teacher"), false);
  assert.equal(payload.groupId, null);
  assert.equal(payload.startsAt, "2026-10-10T03:00:00.000Z");
  assert.equal(resourceSchemas.sessions.partial().safeParse(payload).success, true);
  assert.equal(recordPayload("sessions", { teacherId: "teacher-2" }, [{ name: "teacherId" }], true).teacherId, "teacher-2");
});

test("missing and cleared progress scores remain null while zero remains a score", () => {
  for (const value of [null, "", "0", "76.5"]) {
    const payload = recordPayload("progress", { score: value }, [{ name: "score", kind: "number" }], true);
    assert.equal(payload.score, value === null || value === "" ? null : Number(value));
    assert.equal(resourceSchemas.progress.partial().safeParse(payload).success, true);
  }
});

test("clearing an assignment deadline produces a valid nullable update", () => {
  const payload = recordPayload("assignments", { learnerId: "learner-1", groupId: "", dueAt: "" }, [
    { name: "learnerId" }, { name: "groupId" }, { name: "dueAt", kind: "datetime-local" },
  ], true);
  assert.equal(payload.dueAt, null);
  assert.equal(resourceSchemas.assignments.partial().safeParse(payload).success, true);
});

test("records with omitted optional database fields can be edited", () => {
  const records = {
    learners: { name: "Student", email: null, phone: null, level: null },
    groups: { name: "Class", gradeId: "grade-1", level: null },
    sessions: { location: null },
    lessons: { title: "Lesson", subject: null, level: null },
    progress: { subject: "Speaking", metric: null, score: null },
  };
  for (const [resource, record] of Object.entries(records)) {
    assert.equal(resourceSchemas[resource as keyof typeof records].partial().safeParse(record).success, true, resource);
  }
});
