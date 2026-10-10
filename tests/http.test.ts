import assert from "node:assert/strict";
import test from "node:test";
import { moduleLoader } from "./load-module.ts";
import { Prisma } from "@prisma/client";

const load = moduleLoader({
  "next/server": {
    NextResponse: {
      json: (body: unknown, init?: ResponseInit) => {
        return {
          status: init?.status ?? 200,
          json: async () => body,
        };
      },
    },
  },
});

const http = load<typeof import("../src/lib/http.ts")>("src/lib/http.ts");
const { WorkspaceError } = load<typeof import("../src/lib/workspace.ts")>("src/lib/workspace.ts");

test("jsonError handles WorkspaceError", async () => {
  const error = new WorkspaceError("Test error", 403);
  const response = http.jsonError(error);
  assert.equal(response.status, 403);
  const data = await response.json();
  assert.equal(data.error, "Test error");
});

test("jsonError handles Prisma unique constraint violation", async () => {
  const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.0"
  });
  const response = http.jsonError(error);
  assert.equal(response.status, 409);
  const data = await response.json();
  assert.equal(data.error, "A record with that value already exists.");
});

test("jsonError handles generic errors", async () => {
  const originalError = console.error;
  let loggedError;
  console.error = (err) => { loggedError = err; };

  const error = new Error("Generic error");
  const response = http.jsonError(error);

  console.error = originalError;

  assert.equal(response.status, 500);
  assert.equal(loggedError, error);
  const data = await response.json();
  assert.equal(data.error, "Something went wrong. Please try again.");
});

test("readJson parses valid JSON", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ key: "value" })
  });

  const result = await http.readJson(request);
  assert.deepEqual(result, { key: "value" });
});

test("readJson throws WorkspaceError for invalid JSON", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    body: "invalid json"
  });

  try {
    await http.readJson(request);
    assert.fail("Should have thrown an error");
  } catch (error: unknown) {
    assert(error instanceof WorkspaceError);
    assert.equal(error.constructor.name, "WorkspaceError");
    assert.equal(error.message, "Request body must be valid JSON.");
    assert.equal(error.status, 400);
  }
});
