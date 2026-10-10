import assert from "node:assert/strict";
import test from "node:test";
import { moduleLoader } from "./load-module.ts";

for (const teacherId of [null, "teacher-1"]) {
  test(`seed assigns learners ${teacherId ? "to a teacher" : "to nobody when no teacher exists"}`, async () => {
    const learners: Record<string, unknown>[] = [];
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => { finish = resolve; });
    const db = {
      user: { findFirst: async () => ({ id: "owner" }) },
      membership: {
        findFirst: async ({ where }: { where: { role?: string } }) => {
          if (!where.role) return { centerId: "center", center: { name: "Demo" } };
          assert.equal(where.role, "TEACHER");
          return teacherId ? { userId: teacherId } : null;
        },
      },
      learner: {
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const learner = { ...data, id: `learner-${learners.length}` };
          learners.push(learner); return learner;
        },
      },
      grade: { upsert: async ({ create }: { create: object }) => ({ ...create, id: "grade" }) },
      teachingGroup: {
        findFirst: async () => null,
        create: async ({ data }: { data: object }) => ({ ...data, id: "group" }),
        upsert: async ({ create }: { create: object }) => ({ ...create, id: "group" }),
      },
      groupLearner: { upsert: async () => ({}) },
      teachingSession: { findFirst: async () => ({ id: "existing" }) },
      lesson: { findFirst: async () => ({ id: "existing" }) },
      assignment: { findFirst: async () => ({ id: "existing" }) },
      progressUpdate: { findFirst: async () => ({ id: "existing" }) },
      $disconnect: async () => { finish(); },
    };
    moduleLoader({ "@prisma/client": { PrismaClient: class { constructor() { return db; } } } })("prisma/seed.ts");
    await finished;
    assert.equal(learners.length, 3);
    assert.ok(learners.every((learner) => learner.assignedTeacherId === teacherId));
  });
}
