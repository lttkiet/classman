import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { WorkspaceError } from "@/lib/workspace";

export function jsonError(error: unknown) {
  if (error instanceof WorkspaceError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "A record with that value already exists." }, { status: 409 });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new WorkspaceError("Request body must be valid JSON.", 400);
  }
}
