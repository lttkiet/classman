import assert from "node:assert/strict";
import test from "node:test";
import { moduleLoader } from "./load-module.ts";

class WorkspaceError extends Error {
  status: number;
  constructor(message: string, status: number = 400) {
    super(message);
    this.status = status;
  }
}

const NextResponse = {
  json: (data: unknown, init?: unknown) => ({ data, ...Object(init) }),
};

test("readJson parses valid JSON successfully", async () => {
  const load = moduleLoader({
    "next/server": { NextResponse },
    "@/lib/workspace": { WorkspaceError },
    "@prisma/client": { Prisma: { PrismaClientKnownRequestError: class {} } },
  });

  const { readJson } = load<{ readJson: (req: Request) => Promise<unknown> }>("src/lib/http.ts");

  const request = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ key: "value" }),
  });

  const result = await readJson(request);
  assert.deepEqual(result, { key: "value" });
});

test("readJson throws WorkspaceError for invalid JSON", async () => {
  const load = moduleLoader({
    "next/server": { NextResponse },
    "@/lib/workspace": { WorkspaceError },
    "@prisma/client": { Prisma: { PrismaClientKnownRequestError: class {} } },
  });

  const { readJson } = load<{ readJson: (req: Request) => Promise<unknown> }>("src/lib/http.ts");

  const request = new Request("http://localhost", {
    method: "POST",
    body: "{ invalid: json }",
  });

  try {
    await readJson(request);
    assert.fail("Should have thrown an error");
  } catch (err: unknown) {
    assert(err instanceof WorkspaceError);
    assert.equal(err.message, "Request body must be valid JSON.");
    assert.equal(err.status, 400);
  }
});
