import assert from "node:assert/strict";
import test from "node:test";
import { moduleLoader } from "./load-module.ts";

test("Workspace authorization tests", async (t) => {
    let mockSession: any = null;
    let mockMembership: any = null;

    const load = moduleLoader({
      "next/headers": { headers: async () => ({}) },
      "@prisma/client": { CenterRole: { OWNER: "OWNER", MANAGER: "MANAGER", TEACHER: "TEACHER" } },
      "@/lib/auth": { auth: { api: { getSession: async () => mockSession } } },
      "@/lib/db": { db: { membership: { findUnique: async () => mockMembership } } }
    });

    const { requireWorkspace, WorkspaceError, getWorkspace } = load("src/lib/workspace.ts") as any;

    await t.test("throws if no session", async () => {
        mockSession = null;
        mockMembership = null;
        await assert.rejects(requireWorkspace(), (err: any) => {
            return err instanceof WorkspaceError && err.message === "A center workspace is required." && err.status === 403;
        });
    });

    await t.test("throws if no membership", async () => {
        mockSession = { user: { id: "user-1" } };
        mockMembership = null;
        await assert.rejects(requireWorkspace(), (err: any) => {
            return err instanceof WorkspaceError && err.message === "A center workspace is required." && err.status === 403;
        });
    });

    await t.test("throws if no center in membership", async () => {
        mockSession = { user: { id: "user-1" } };
        mockMembership = { role: "TEACHER", center: null };
        await assert.rejects(requireWorkspace(), (err: any) => {
            return err instanceof WorkspaceError && err.message === "A center workspace is required." && err.status === 403;
        });
    });

    await t.test("returns workspace if valid membership and no roles specified", async () => {
        mockSession = { user: { id: "user-1" } };
        mockMembership = { role: "TEACHER", center: { id: "center-1" } };
        const workspace = await requireWorkspace();
        assert.equal(workspace.user.id, "user-1");
        assert.equal(workspace.membership.role, "TEACHER");
        assert.equal(workspace.center.id, "center-1");
    });

    await t.test("throws if user does not have required role", async () => {
        mockSession = { user: { id: "user-1" } };
        mockMembership = { role: "TEACHER", center: { id: "center-1" } };
        await assert.rejects(requireWorkspace(["OWNER", "MANAGER"]), (err: any) => {
            return err instanceof WorkspaceError && err.message === "You do not have permission to do that." && err.status === 403;
        });
    });

    await t.test("returns workspace if user has required role", async () => {
        mockSession = { user: { id: "user-1" } };
        mockMembership = { role: "MANAGER", center: { id: "center-1" } };
        const workspace = await requireWorkspace(["OWNER", "MANAGER"]);
        assert.equal(workspace.user.id, "user-1");
        assert.equal(workspace.membership.role, "MANAGER");
        assert.equal(workspace.center.id, "center-1");
    });

    await t.test("getWorkspace returns null when no session", async () => {
        mockSession = null;
        mockMembership = null;
        const workspace = await getWorkspace();
        assert.equal(workspace, null);
    });

    await t.test("getWorkspace returns user with null membership when not found", async () => {
        mockSession = { user: { id: "user-1" } };
        mockMembership = null;
        const workspace = await getWorkspace();
        assert.equal(workspace.user.id, "user-1");
        assert.equal(workspace.membership, null);
        assert.equal(workspace.center, null);
    });
});
