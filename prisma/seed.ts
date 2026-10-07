import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const owner = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!owner) throw new Error("Create and verify a teacher account in the app before seeding sample records.");
  let membership = await db.membership.findFirst({ where: { userId: owner.id }, include: { center: true } });
  if (!membership) {
    const center = await db.center.create({ data: { name: "Bright Path Language Studio" } });
    membership = await db.membership.create({ data: { userId: owner.id, centerId: center.id, role: "OWNER" }, include: { center: true } });
  }
  const centerId = membership.centerId;
  const teacher = await db.membership.findFirst({ where: { centerId, role: { in: ["OWNER", "MANAGER"] } } });
  const teacherId = teacher ? (await db.membership.findUnique({ where: { id: teacher.id } }))?.userId ?? owner.id : owner.id;
  const learners = await Promise.all([
    { name: "Mia Chen", email: "mia@example.test", level: "A2 · Elementary", goal: "Build confidence in everyday conversation" },
    { name: "Noah Patel", email: "noah@example.test", level: "B1 · Intermediate", goal: "Prepare for a study abroad interview" },
    { name: "Sofia Nguyen", email: "sofia@example.test", level: "A1 · Beginner", goal: "Read short stories with confidence" },
  ].map(async (item) => {
    const old = await db.learner.findFirst({ where: { centerId, name: item.name } });
    return old ? db.learner.update({ where: { id: old.id }, data: { ...item, assignedTeacherId: teacherId } }) : db.learner.create({ data: { ...item, centerId, assignedTeacherId: teacherId } });
  }));
  const [grade6, grade7] = await Promise.all(["Grade 6", "Grade 7"].map((name) => db.grade.upsert({
    where: { centerId_name: { centerId, name } },
    create: { centerId, name },
    update: {},
  })));
  const existingGroup = await db.teachingGroup.findFirst({ where: { centerId, name: { in: ["Everyday English · A2", "6A"] } } });
  const group = existingGroup
    ? await db.teachingGroup.update({ where: { id: existingGroup.id }, data: { name: "6A", gradeId: grade6.id, level: "A2", description: "Friendly weekly conversation practice." } })
    : await db.teachingGroup.create({ data: { centerId, gradeId: grade6.id, name: "6A", level: "A2", description: "Friendly weekly conversation practice." } });
  const class6b = await db.teachingGroup.upsert({ where: { centerId_name: { centerId, name: "6B" } }, create: { centerId, gradeId: grade6.id, name: "6B" }, update: { gradeId: grade6.id } });
  await db.teachingGroup.upsert({ where: { centerId_name: { centerId, name: "7A" } }, create: { centerId, gradeId: grade7.id, name: "7A" }, update: { gradeId: grade7.id } });
  await db.teachingGroup.upsert({ where: { centerId_name: { centerId, name: "7B" } }, create: { centerId, gradeId: grade7.id, name: "7B" }, update: { gradeId: grade7.id } });
  await db.groupLearner.upsert({ where: { groupId_learnerId: { groupId: group.id, learnerId: learners[0].id } }, create: { groupId: group.id, learnerId: learners[0].id }, update: {} });
  await db.groupLearner.upsert({ where: { groupId_learnerId: { groupId: group.id, learnerId: learners[2].id } }, create: { groupId: group.id, learnerId: learners[2].id }, update: {} });
  await db.groupLearner.upsert({ where: { groupId_learnerId: { groupId: class6b.id, learnerId: learners[1].id } }, create: { groupId: class6b.id, learnerId: learners[1].id }, update: {} });
  const nextDay = new Date(); nextDay.setDate(nextDay.getDate() + 1); nextDay.setHours(10, 0, 0, 0);
  const endDay = new Date(nextDay); endDay.setHours(11, 0, 0, 0);
  if (!(await db.teachingSession.findFirst({ where: { centerId, title: "Conversation practice" } }))) {
    await db.teachingSession.create({ data: { centerId, teacherId, groupId: group.id, title: "Conversation practice", startsAt: nextDay, endsAt: endDay, location: "Studio 2" } });
  }
  if (!(await db.lesson.findFirst({ where: { centerId, title: "A story from my week" } }))) {
    await db.lesson.create({ data: { centerId, title: "A story from my week", subject: "Speaking", level: "A2", content: "Warm up with three simple past-tense prompts, then invite each learner to share a short story.", materials: "Prompt cards · 15 minutes" } });
  }
  if (!(await db.assignment.findFirst({ where: { centerId, title: "My week in five sentences" } }))) {
    await db.assignment.create({ data: { centerId, learnerId: learners[0].id, title: "My week in five sentences", description: "Write five short sentences about something you did this week.", dueAt: nextDay } });
  }
  if (!(await db.progressUpdate.findFirst({ where: { centerId, learnerId: learners[0].id, subject: "Speaking" } }))) {
    await db.progressUpdate.create({ data: { centerId, learnerId: learners[0].id, teacherId, subject: "Speaking", metric: "Conversation confidence", score: 76, note: "Started a conversation without a prompt and used two new expressions." } });
  }
  console.info(`Sample teaching records are ready for ${membership.center.name}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
