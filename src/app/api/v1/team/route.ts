import { createHash, randomBytes } from "node:crypto";
import { CenterRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { assertCanManage, centerStaff } from "@/lib/api";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { jsonError, readJson } from "@/lib/http";
import { invitationSchema } from "@/lib/validation";
import { requireWorkspace } from "@/lib/workspace";

export async function GET() {
  try {
    const staff = await centerStaff(await requireWorkspace());
    return NextResponse.json({ data: staff });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspace();
    assertCanManage(ctx);
    const parsed = invitationSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid invitation." },
        { status: 422 },
      );
    const email = parsed.data.email.toLowerCase();
    const existingMembership = await db.membership.findFirst({
      where: { user: { email } },
      select: { id: true },
    });
    if (existingMembership)
      return NextResponse.json(
        { error: "This person is already part of the center." },
        { status: 409 },
      );
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const invitation = await db.invitation.create({
      data: {
        centerId: ctx.center.id,
        email,
        role: parsed.data.role as CenterRole,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 86400000),
        invitedById: ctx.user.id,
      },
    });
    const url = `${process.env.APP_URL ?? "http://localhost:3000"}/invite/${token}`;
    try {
      await sendEmail(
        email,
        `Join ${ctx.center.name} on Classman`,
        `${ctx.user.name} invited you to ${ctx.center.name}. Accept your invitation: ${url}`,
      );
    } catch (error) {
      await db.invitation.delete({ where: { id: invitation.id } });
      throw error;
    }
    return NextResponse.json(
      {
        data: {
          id: invitation.id,
          email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
