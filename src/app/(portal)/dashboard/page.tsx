import Link from "next/link";
import { ArrowUpRight, BookOpen, CalendarCheck2, GraduationCap, UsersRound } from "lucide-react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { translate } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";

const time = (date: Date, language: Language) => new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
const shortDate = (date: Date, language: Language) => new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(date);

export default async function DashboardPage() {
  const ctx = await requireWorkspace();
  const languageCookie = (await cookies()).get("teach-language")?.value;
  const language: Language = languageCookie === "vi" ? "vi" : "en";
  const t = (text: string, values?: Record<string, string | number>) => translate(language, text, values);
  const now = new Date();
  const teacher = ctx.membership.role === "TEACHER" ? { assignedTeacherId: ctx.user.id } : {};
  const sessionTeacher = ctx.membership.role === "TEACHER" ? { teacherId: ctx.user.id } : {};
  const assignmentScope = ctx.membership.role === "TEACHER" ? { OR: [{ learner: { assignedTeacherId: ctx.user.id } }, { group: { learners: { some: { learner: { assignedTeacherId: ctx.user.id } } } } }] } : {};
  const [learnerCount, groupCount, upcomingCount, sessions, pendingCount, assignments, recentProgress] = await Promise.all([
    db.learner.count({ where: { centerId: ctx.center.id, status: "ACTIVE", ...teacher } }),
    db.teachingGroup.count({ where: { centerId: ctx.center.id, ...(ctx.membership.role === "TEACHER" ? { learners: { some: { learner: { assignedTeacherId: ctx.user.id } } } } : {}) } }),
    db.teachingSession.count({ where: { centerId: ctx.center.id, startsAt: { gte: now }, status: "SCHEDULED", ...sessionTeacher } }),
    db.teachingSession.findMany({ where: { centerId: ctx.center.id, startsAt: { gte: now }, status: "SCHEDULED", ...sessionTeacher }, include: { learner: true, group: true, teacher: true }, orderBy: { startsAt: "asc" }, take: 4 }),
    db.assignment.count({ where: { centerId: ctx.center.id, status: { not: "COMPLETED" }, ...assignmentScope } }),
    db.assignment.findMany({ where: { centerId: ctx.center.id, status: { not: "COMPLETED" }, ...assignmentScope }, include: { learner: true, group: true }, orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }], take: 4 }),
    db.progressUpdate.findMany({ where: { centerId: ctx.center.id, ...(ctx.membership.role === "TEACHER" ? { learner: { assignedTeacherId: ctx.user.id } } : {}) }, include: { learner: true }, orderBy: { recordedAt: "desc" }, take: 4 }),
  ]);
  const greeting = new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en", { weekday: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(now);
  const firstName = ctx.user.name.split(" ")[0];
  const stats = [
    { label: t("Active students"), value: learnerCount, hint: t("Your teaching community"), icon: GraduationCap, tone: "#eaf4ee", color: "#4d8967" },
    { label: t("Classes"), value: groupCount, hint: t("Small steps, together"), icon: UsersRound, tone: "#fff5e2", color: "#bd8642" },
    { label: t("Sessions ahead"), value: upcomingCount, hint: t("On your calendar"), icon: CalendarCheck2, tone: "#eef4f8", color: "#5d8198" },
    { label: t("Open assignments"), value: pendingCount, hint: t("Ready for a little follow-up"), icon: BookOpen, tone: "#fff0eb", color: "#d4775f" },
  ];
  return <main className="page-content">
    <section className="dashboard-hero"><div className="hero-copy"><div className="hero-kicker">{greeting} · {ctx.center.name}</div><h1 className="hero-title">{t("A good day to make progress, {name}.", { name: firstName })}</h1><p className="hero-text">{t("Your classes, students, and teaching notes are right where you need them.")}</p></div><div className="hero-date">{shortDate(now, language)}</div></section>
    <section className="stats-grid">{stats.map(({ label, value, hint, icon: Icon, tone, color }) => <article className="stat-card" key={label}><div className="stat-top"><span className="stat-label">{label}</span><div className="stat-icon" style={{ color, background: tone }}><Icon size={16} /></div></div><div className="stat-value">{value}</div><div className="stat-foot">{hint}</div></article>)}</section>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">{t("Coming up next")}</div><p className="panel-subtitle">{t("A little look at your teaching day")}</p></div><Link className="text-link" href="/schedule">{t("Full schedule")} <ArrowUpRight size={12} style={{ verticalAlign: "middle" }} /></Link></div><div className="session-list">{sessions.length ? sessions.map((item) => <div className="session-row" key={item.id}><div className="session-time">{time(item.startsAt, language)}</div><div className="session-divider" style={{ background: item.groupId ? "#e9bd6a" : "#82b393" }} /><div className="session-details"><div className="session-title">{item.title}</div><div className="session-meta">{item.learner?.name ?? item.group?.name ?? t("Student")} · {time(item.startsAt, language)}–{time(item.endsAt, language)}</div></div><span className="session-tag">{item.teacher.name.split(" ")[0]}</span></div>) : <div className="empty-state" style={{ minHeight: 150 }}><div className="empty-title">{t("A little breathing room")}</div><div className="empty-copy">{t("No upcoming sessions yet. Add one when your next lesson is ready.")}</div><Link href="/schedule" className="text-link">{t("Open schedule →")}</Link></div>}</div></section>
      <section className="panel"><div className="panel-header"><div><div className="panel-title">{t("Gentle reminders")}</div><p className="panel-subtitle">{t("A few things to keep on your radar")}</p></div><Link className="text-link" href="/assignments">{t("See all")}</Link></div><div className="task-list">{assignments.length ? assignments.map((item) => <div className="task-row" key={item.id}><div className="task-dot" style={{ background: item.dueAt && item.dueAt < now ? "#df7662" : "#e9b553" }} /><div><div className="task-title">{item.title}</div><div className="task-meta">{item.learner?.name ?? item.group?.name ?? t("Class assignment")}{item.dueAt ? ` · ${t("Due {date}", { date: shortDate(item.dueAt, language) })}` : ` · ${t("No due date")}`}</div></div></div>) : <div className="empty-state" style={{ minHeight: 150 }}><div className="empty-title">{t("All caught up")}</div><div className="empty-copy">{t("There are no open assignments to follow up on.")}</div></div>}</div></section>
    </div>
    <section className="panel progress-card"><div className="panel-header" style={{ padding: 0 }}><div><div className="panel-title">{t("Recent student progress")}</div><p className="panel-subtitle">{t("Small wins add up")}</p></div><Link className="text-link" href="/progress">{t("View progress →")}</Link></div>{recentProgress.length ? recentProgress.map((item) => <div className="progress-item" key={item.id}><span className="progress-name">{item.learner.name}</span><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(2, Math.min(100, item.score ?? 70))}%` }} /></div><span className="progress-number">{item.score === null ? t("New") : `${item.score}%`}</span></div>) : <div className="empty-state" style={{ minHeight: 130 }}><div className="empty-title">{t("Progress starts with a note")}</div><div className="empty-copy">{t("Record a student update to keep their growth visible.")}</div><Link href="/progress" className="text-link">{t("Add progress →")}</Link></div>}</section>
  </main>;
}
