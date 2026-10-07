import { hashPassword } from "better-auth/crypto";
import { Prisma, PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const centerName = process.env.BOOTSTRAP_CENTER_NAME?.trim();
  if (!email || !name || !centerName || !password || password.length < 8) {
    throw new Error("Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_PASSWORD (8+ characters), and BOOTSTRAP_CENTER_NAME.");
  }

  await db.$transaction(async (tx) => {
    if (await tx.user.count()) throw new Error("Bootstrap is only available before the first user is created.");
    const user = await tx.user.create({ data: { email, name, emailVerified: true } });
    await tx.account.create({ data: { accountId: user.id, providerId: "credential", userId: user.id, password: await hashPassword(password) } });
    const center = await tx.center.create({ data: { name: centerName } });
    await tx.membership.create({ data: { centerId: center.id, userId: user.id, role: "OWNER" } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  console.info(`Created the owner account and center for ${email}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
