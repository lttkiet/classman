import assert from "node:assert/strict";
import test from "node:test";
import { canCreateResource, canDeleteResource, canSeeAllCenterRecords, canUpdateResource } from "../src/lib/access.ts";
import { groupRosterWhere, hasExactlyOneTarget, hasValidSessionWindow, teacherCompletionUpdate } from "../src/lib/scope-rules.ts";

test("owners and managers can manage center resources", () => {
  for (const role of ["OWNER", "MANAGER"] as const) {
    assert.equal(canCreateResource(role, "learners"), true);
    assert.equal(canCreateResource(role, "grades"), true);
    assert.equal(canUpdateResource(role, "assignments"), true);
    assert.equal(canDeleteResource(role), true);
    assert.equal(canSeeAllCenterRecords(role), true);
  }
});

test("teachers can work only on assigned teaching workflows", () => {
  assert.equal(canCreateResource("TEACHER", "sessions"), true);
  assert.equal(canCreateResource("TEACHER", "notes"), true);
  assert.equal(canCreateResource("TEACHER", "progress"), true);
  assert.equal(canCreateResource("TEACHER", "learners"), false);
  assert.equal(canCreateResource("TEACHER", "grades"), false);
  assert.equal(canCreateResource("TEACHER", "assignments"), false);
  assert.equal(canUpdateResource("TEACHER", "assignments"), true);
  assert.equal(canUpdateResource("TEACHER", "sessions"), true);
  assert.equal(canDeleteResource("TEACHER"), false);
  assert.equal(canSeeAllCenterRecords("TEACHER"), false);
});

test("teacher group rosters are filtered to assigned learners", () => {
  assert.deepEqual(groupRosterWhere("TEACHER", "teacher-1"), { learner: { assignedTeacherId: "teacher-1" } });
  assert.deepEqual(groupRosterWhere("MANAGER", "manager-1"), {});
});

test("session and assignment records target one learner or group", () => {
  assert.equal(hasExactlyOneTarget("learner-1", null), true);
  assert.equal(hasExactlyOneTarget(null, "group-1"), true);
  assert.equal(hasExactlyOneTarget(null, null), false);
  assert.equal(hasExactlyOneTarget("learner-1", "group-1"), false);
});

test("teachers can only complete or reopen assignments, with server-owned timestamps", () => {
  const completedAt = new Date("2026-10-07T09:00:00Z");
  assert.deepEqual(teacherCompletionUpdate({ status: "COMPLETED", completedAt: "2000-01-01T00:00:00Z" }, completedAt), { status: "COMPLETED", completedAt });
  assert.deepEqual(teacherCompletionUpdate({ status: "ASSIGNED" }, completedAt), { status: "ASSIGNED", completedAt: null });
  assert.equal(teacherCompletionUpdate({ status: "NEEDS_REVIEW" }, completedAt), null);
  assert.equal(teacherCompletionUpdate({ status: "COMPLETED", title: "Retarget" }, completedAt), null);
});

test("session windows require a valid end after the start", () => {
  assert.equal(hasValidSessionWindow("2026-10-06T03:00:00.000Z", "2026-10-06T04:00:00.000Z"), true);
  assert.equal(hasValidSessionWindow("2026-10-06T04:00:00.000Z", "2026-10-06T04:00:00.000Z"), false);
  assert.equal(hasValidSessionWindow("2026-10-06T05:00:00.000Z", "2026-10-06T04:00:00.000Z"), false);
});
