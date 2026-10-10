import assert from "node:assert/strict";
import test from "node:test";
import { moduleLoader } from "./load-module.ts";

let mockDb: any = {};

class MockWorkspaceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const loadTransfers = () => {
  const overrides = {
    "@/lib/db": { db: mockDb },
    "@/lib/workspace": { WorkspaceError: MockWorkspaceError },
  };
  return moduleLoader(overrides)("src/lib/transfers.ts") as typeof import("../src/lib/transfers.ts");
};

function createCtx(role: string = "TEACHER", userId: string = "user-1", centerId: string = "center-1"): any {
  return {
    user: { id: userId },
    center: { id: centerId },
    membership: { role },
  };
}

test("createTransfer - only teachers can request", async () => {
  const { createTransfer } = loadTransfers();
  const ctx = createCtx("MANAGER");

  await assert.rejects(
    async () => createTransfer(ctx, { learnerId: "l1", targetTeacherId: "t2" }),
    (err: any) => err.message === "Only teachers can request a student transfer." && err.status === 403
  );
});

test("createTransfer - student not actively assigned", async () => {
  const { createTransfer } = loadTransfers();
  const ctx = createCtx();

  mockDb.learner = { findFirst: async () => null };
  mockDb.membership = { findFirst: async () => ({ userId: "t2", role: "TEACHER" }) };

  await assert.rejects(
    async () => createTransfer(ctx, { learnerId: "l1", targetTeacherId: "t2" }),
    (err: any) => err.message === "This student is not actively assigned to you." && err.status === 404
  );
});

test("createTransfer - target teacher not found", async () => {
  const { createTransfer } = loadTransfers();
  const ctx = createCtx();

  mockDb.learner = { findFirst: async () => ({ id: "l1" }) };
  mockDb.membership = { findFirst: async () => null };

  await assert.rejects(
    async () => createTransfer(ctx, { learnerId: "l1", targetTeacherId: "t2" }),
    (err: any) => err.message === "Choose another teacher from your center." && err.status === 422
  );
});

test("createTransfer - target teacher is self", async () => {
  const { createTransfer } = loadTransfers();
  const ctx = createCtx("TEACHER", "user-1");

  mockDb.learner = { findFirst: async () => ({ id: "l1" }) };
  mockDb.membership = { findFirst: async () => ({ userId: "user-1", role: "TEACHER" }) };

  await assert.rejects(
    async () => createTransfer(ctx, { learnerId: "l1", targetTeacherId: "user-1" }),
    (err: any) => err.message === "Choose another teacher from your center." && err.status === 422
  );
});

test("createTransfer - student already has pending request", async () => {
  const { createTransfer } = loadTransfers();
  const ctx = createCtx();

  mockDb.learner = { findFirst: async () => ({ id: "l1" }) };
  mockDb.membership = { findFirst: async () => ({ userId: "t2", role: "TEACHER" }) };
  mockDb.transferRequest = { findFirst: async () => ({ id: "tr1", status: "PENDING" }) };

  await assert.rejects(
    async () => createTransfer(ctx, { learnerId: "l1", targetTeacherId: "t2" }),
    (err: any) => err.message === "This student already has a pending transfer request." && err.status === 409
  );
});

test("createTransfer - creates a request", async () => {
  const { createTransfer } = loadTransfers();
  const ctx = createCtx();

  mockDb.learner = { findFirst: async () => ({ id: "l1" }) };
  mockDb.membership = { findFirst: async () => ({ userId: "t2", role: "TEACHER" }) };
  mockDb.transferRequest = {
    findFirst: async () => null,
    create: async (args: any) => ({ ...args.data, id: "tr-new", include: args.include })
  };

  const result = await createTransfer(ctx, { learnerId: "l1", targetTeacherId: "t2", message: "please transfer" });

  assert.equal(result.learnerId, "l1");
  assert.equal(result.targetTeacherId, "t2");
  assert.equal(result.requesterId, "user-1");
  assert.equal(result.message, "please transfer");
  assert.equal(result.centerId, "center-1");
  assert.ok(result.include.learner);
});

// Add respondToTransfer test cases to have full coverage
test("respondToTransfer - only teachers involved can respond", async () => {
  const { respondToTransfer } = loadTransfers();
  const ctx = createCtx("MANAGER");

  await assert.rejects(
    async () => respondToTransfer(ctx, "tr1", { action: "accept" }),
    (err: any) => err.message === "Only the teachers involved can respond to a transfer." && err.status === 403
  );
});

test("respondToTransfer - not found", async () => {
  const { respondToTransfer } = loadTransfers();
  const ctx = createCtx();

  mockDb.transferRequest = { findFirst: async () => null };

  await assert.rejects(
    async () => respondToTransfer(ctx, "tr1", { action: "accept" }),
    (err: any) => err.message === "Transfer request not found." && err.status === 404
  );
});

test("respondToTransfer - cancel, must be requester", async () => {
  const { respondToTransfer } = loadTransfers();
  const ctx = createCtx("TEACHER", "user-1");

  mockDb.transferRequest = { findFirst: async () => ({ requesterId: "t2" }) };

  await assert.rejects(
    async () => respondToTransfer(ctx, "tr1", { action: "cancel" }),
    (err: any) => err.message === "Only the requesting teacher can cancel this request." && err.status === 403
  );
});

test("respondToTransfer - accept, must be target teacher", async () => {
  const { respondToTransfer } = loadTransfers();
  const ctx = createCtx("TEACHER", "user-1");

  mockDb.transferRequest = { findFirst: async () => ({ targetTeacherId: "t2" }) };

  await assert.rejects(
    async () => respondToTransfer(ctx, "tr1", { action: "accept" }),
    (err: any) => err.message === "Only the target teacher can respond to this request." && err.status === 403
  );
});

test("respondToTransfer - decline, must be target teacher", async () => {
  const { respondToTransfer } = loadTransfers();
  const ctx = createCtx("TEACHER", "user-1");

  mockDb.transferRequest = { findFirst: async () => ({ targetTeacherId: "t2" }) };

  await assert.rejects(
    async () => respondToTransfer(ctx, "tr1", { action: "decline" }),
    (err: any) => err.message === "Only the target teacher can respond to this request." && err.status === 403
  );
});
