import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { moduleLoader } from "./load-module.ts";
import type { WorkspaceContext } from "../src/lib/workspace.ts";

class WorkspaceError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

function fixture(member = true) {
  const user = { id: "staff", email: "staff@example.test" };
  let membership: object | null = member ? { id: "membership", userId: user.id, role: "MANAGER", user } : null;
  let invitations = ["first", "second"].map((token) => ({ id: token, tokenHash: createHash("sha256").update(token).digest("hex"), email: user.email, centerId: "center", role: "MANAGER", acceptedAt: null as Date | null, expiresAt: new Date(Date.now() + 86400000) }));
  const db = {
    membership: {
      findFirst: async () => membership,
      findUnique: async () => membership,
      delete: async () => { membership = null; },
      create: async ({ data }: { data: object }) => { membership = data; return data; },
    },
    invitation: {
      findFirst: async ({ where }: { where: { tokenHash: string } }) => invitations.find((item) => item.tokenHash === where.tokenHash && !item.acceptedAt) ?? null,
      deleteMany: async ({ where }: { where: { centerId: string; email: { equals: string; mode: string }; acceptedAt: null } }) => {
        assert.equal(where.acceptedAt, null);
        assert.equal(where.email.mode, "insensitive");
        invitations = invitations.filter((item) => !(item.centerId === where.centerId && item.email.toLowerCase() === where.email.equals.toLowerCase() && item.acceptedAt === null));
      },
      updateMany: async ({ where, data }: { where: { id: string }; data: { acceptedAt: Date } }) => {
        const item = invitations.find((item) => item.id === where.id && !item.acceptedAt);
        if (!item) return { count: 0 };
        item.acceptedAt = data.acceptedAt;
        return { count: 1 };
      },
    },
    async $transaction<T>(callback: (tx: object) => Promise<T>): Promise<T> {
      const previous = structuredClone({ membership, invitations });
      try { return await callback(db); } catch (error) {
        membership = previous.membership; invitations = previous.invitations; throw error;
      }
    },
  };
  const load = moduleLoader({
    "@/lib/db": { db }, "@/lib/workspace": { WorkspaceError },
    "@/lib/auth": { auth: { api: { getSession: async () => ({ user }) } } },
    "next/headers": { headers: async () => new Headers() }, "next/server": { NextResponse: Response },
    "@/lib/http": { jsonError: (error: WorkspaceError) => Response.json({ error: error.message }, { status: error.status || 500 }) },
  });
  const api = load<typeof import("../src/lib/api.ts")>("src/lib/api.ts");
  const route = load<typeof import("../src/app/api/v1/invitations/[token]/route.ts")>("src/app/api/v1/invitations/[token]/route.ts");
  const ctx = { user: { id: "owner" }, center: { id: "center" }, membership: { role: "OWNER" } } as WorkspaceContext;
  return { db, api, ctx, remaining: () => invitations, accept: (token: string) => route.POST(new Request("http://localhost/invite", { method: "POST" }), { params: Promise.resolve({ token }) }) };
}

test("removing a staff member prevents rejoining through every outstanding invitation", async () => {
  const f = fixture();
  await f.api.removeStaff(f.ctx, "staff");
  assert.equal((await f.accept("first")).status, 404);
  assert.equal((await f.accept("second")).status, 404);
  assert.equal(await f.db.membership.findUnique(), null);
});

test("acceptance invalidates duplicate invitations while retaining the accepted record", async () => {
  const f = fixture(false);
  assert.equal((await f.accept("first")).status, 200);
  assert.equal(f.remaining().length, 1);
  assert.ok(f.remaining()[0].acceptedAt);
  assert.equal((await f.accept("second")).status, 404);
});

test("staff-removal failure rolls back invitation revocation", async () => {
  const f = fixture();
  f.db.membership.delete = async () => { throw new Error("Database failure"); };
  await assert.rejects(f.api.removeStaff(f.ctx, "staff"), /Database failure/);
  assert.equal(f.remaining().length, 2);
  assert.ok(await f.db.membership.findUnique());
});
