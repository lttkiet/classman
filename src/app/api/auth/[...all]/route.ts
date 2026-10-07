import { createHash } from "node:crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toNextJsHandler } from "better-auth/next-js";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;

export async function POST(request: Request) {
  if (new URL(request.url).pathname.endsWith("/sign-up/email")) {
    const token = request.headers.get("x-center-invitation");
    const body = await request.clone().json().catch(() => null) as { email?: string } | null;
    const tokenHash = token ? createHash("sha256").update(token).digest("hex") : "";
    const invitation = tokenHash ? await db.invitation.findFirst({
      where: { tokenHash, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { email: true },
    }) : null;
    if (!invitation || invitation.email.toLowerCase() !== body?.email?.toLowerCase()) {
      return Response.json({ message: "A valid center invitation is required to create an account." }, { status: 403 });
    }
  }
  return handlers.POST(request);
}
