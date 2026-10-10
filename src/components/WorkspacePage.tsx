"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, Check, ClipboardList, GraduationCap, Plus, Search, Eye, UsersRound, X, Trash2, Pencil, Send, UserPlus } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { recordPayload } from "@/lib/record-form";

type Resource = "grades" | "learners" | "groups" | "sessions" | "lessons" | "notes" | "assignments" | "progress";
type Field = { name: string; label: string; kind?: "text" | "email" | "textarea" | "select" | "datetime-local" | "number"; required?: boolean; full?: boolean; options?: { label: string; value: string }[] };
type Config = { resource: Resource; title: string; description: string; singular: string; icon: typeof UsersRound; columns: { key: string; label: string }[]; fields: Field[]; createRole?: boolean };
type JsonValue = string | number | boolean | null | undefined | Date | JsonRow | JsonRow[];
type JsonRow = { [key: string]: JsonValue };

const TOAST_DELAY_MS = 2500;

const baseConfigs: Record<string, Config> = {
  grades: { resource: "grades", title: "Grades", description: "Organize your students by grade, with multiple classes in each grade.", singular: "grade", icon: GraduationCap, columns: [{ key: "name", label: "Grade" }, { key: "classes.length", label: "Classes" }, { key: "description", label: "About" }, { key: "status", label: "Status" }], fields: [{ name: "name", label: "Grade name", required: true }, { name: "description", label: "Description", kind: "textarea", full: true }] },
  learners: { resource: "learners", title: "Students", description: "Keep each student’s goals, details, and teaching team in one place.", singular: "student", icon: GraduationCap, columns: [{ key: "name", label: "Student" }, { key: "level", label: "Level" }, { key: "goal", label: "Learning goal" }, { key: "assignedTeacher.name", label: "Teacher" }, { key: "status", label: "Status" }], fields: [{ name: "name", label: "Student name", required: true }, { name: "email", label: "Email", kind: "email" }, { name: "phone", label: "Phone" }, { name: "level", label: "Current level" }, { name: "goal", label: "Learning goal", kind: "textarea", full: true }, { name: "assignedTeacherId", label: "Assigned teacher", kind: "select", full: true }, { name: "notes", label: "Notes", kind: "textarea", full: true }] },
  groups: { resource: "groups", title: "Classes", description: "Each class belongs to a grade. For example, Grade 6 can include 6A and 6B.", singular: "class", icon: UsersRound, columns: [{ key: "name", label: "Class" }, { key: "grade.name", label: "Grade" }, { key: "level", label: "Course level" }, { key: "learners.length", label: "Students" }, { key: "description", label: "About" }, { key: "status", label: "Status" }], fields: [{ name: "gradeId", label: "Grade", kind: "select", required: true, full: true }, { name: "name", label: "Class name", required: true }, { name: "level", label: "Course level" }, { name: "description", label: "Description", kind: "textarea", full: true }] },
  schedule: { resource: "sessions", title: "Teaching schedule", description: "Plan sessions and keep attendance and lesson details close at hand.", singular: "session", icon: CalendarDays, columns: [{ key: "startsAt", label: "Date & time" }, { key: "title", label: "Session" }, { key: "learner.name", label: "Student or class" }, { key: "teacher.name", label: "Teacher" }, { key: "attendance", label: "Attendance" }, { key: "status", label: "Status" }], fields: [{ name: "title", label: "Session title", required: true }, { name: "learnerId", label: "One-to-one student", kind: "select" }, { name: "groupId", label: "Class", kind: "select" }, { name: "teacherId", label: "Assigned teacher", kind: "select" }, { name: "startsAt", label: "Starts at", kind: "datetime-local", required: true }, { name: "endsAt", label: "Ends at", kind: "datetime-local", required: true }, { name: "attendance", label: "Attendance", kind: "select", options: [{ label: "Not marked", value: "NOT_MARKED" }, { label: "Present", value: "PRESENT" }, { label: "Absent", value: "ABSENT" }, { label: "Late", value: "LATE" }, { label: "Excused", value: "EXCUSED" }] }, { name: "status", label: "Session status", kind: "select", options: [{ label: "Scheduled", value: "SCHEDULED" }, { label: "Completed", value: "COMPLETED" }, { label: "Cancelled", value: "CANCELLED" }] }, { name: "location", label: "Location or meeting link", full: true }] },
  lessons: { resource: "lessons", title: "Lesson library", description: "Collect lesson plans and materials your team can return to.", singular: "lesson", icon: BookOpen, columns: [{ key: "title", label: "Lesson" }, { key: "subject", label: "Subject" }, { key: "level", label: "Level" }, { key: "content", label: "Plan" }, { key: "status", label: "Status" }], fields: [{ name: "title", label: "Lesson title", required: true }, { name: "subject", label: "Subject" }, { name: "level", label: "Level" }, { name: "status", label: "Status", kind: "select", options: [{ label: "Active", value: "ACTIVE" }, { label: "Archived", value: "ARCHIVED" }] }, { name: "content", label: "Lesson plan", kind: "textarea", full: true }, { name: "materials", label: "Materials or links", kind: "textarea", full: true }] },
  notes: { resource: "notes", title: "Session notes", description: "Capture what worked and what to pick up next time.", singular: "note", icon: BookOpen, columns: [{ key: "title", label: "Note" }, { key: "learner.name", label: "Student" }, { key: "content", label: "Observation" }, { key: "teacher.name", label: "Teacher" }, { key: "createdAt", label: "Added" }], fields: [{ name: "learnerId", label: "Student", kind: "select", required: true }, { name: "title", label: "Note title", required: true }, { name: "content", label: "Session note", kind: "textarea", full: true }] },
  assignments: { resource: "assignments", title: "Assignments", description: "Give students a clear next step and track how it’s going.", singular: "assignment", icon: ClipboardList, columns: [{ key: "title", label: "Assignment" }, { key: "learner.name", label: "Student or class" }, { key: "dueAt", label: "Due" }, { key: "status", label: "Status" }], fields: [{ name: "title", label: "Assignment title", required: true }, { name: "learnerId", label: "One-to-one student", kind: "select" }, { name: "groupId", label: "Class", kind: "select" }, { name: "dueAt", label: "Due date", kind: "datetime-local" }, { name: "status", label: "Status", kind: "select", options: [{ label: "Assigned", value: "ASSIGNED" }, { label: "Needs review", value: "NEEDS_REVIEW" }, { label: "Completed", value: "COMPLETED" }] }, { name: "description", label: "Instructions", kind: "textarea", full: true }] },
  progress: { resource: "progress", title: "Student progress", description: "Make growth visible, one observation at a time.", singular: "progress update", icon: GraduationCap, columns: [{ key: "learner.name", label: "Student" }, { key: "subject", label: "Subject" }, { key: "metric", label: "Focus" }, { key: "score", label: "Score" }, { key: "note", label: "Observation" }, { key: "recordedAt", label: "Recorded" }], fields: [{ name: "learnerId", label: "Student", kind: "select", required: true }, { name: "subject", label: "Subject", required: true }, { name: "metric", label: "Skill or focus area" }, { name: "score", label: "Progress score (0–100)", kind: "number" }, { name: "note", label: "Observation", kind: "textarea", full: true }] },
};

const sectionCopy: Record<string, string> = { grades: "A grade can contain several classes, such as Grade 6 with classes 6A and 6B.", learners: "Each student profile brings their goals and progress together.", groups: "Every class belongs to a grade. Add multiple classes to the same grade.", schedule: "Plan one-to-one lessons and classes, then capture attendance as you go.", lessons: "Keep reusable lesson plans close by, so great teaching is easier to repeat.", notes: "Leave a thoughtful note for yourself or another teacher to pick up next time.", assignments: "Give a student a clear next step and keep an eye on due dates.", progress: "Write down the small wins and milestones that show learning is moving forward." };

function valueAt(row: JsonRow, path: string, language: "en" | "vi", t: (text: string) => string) {
  if (path === "learners.length") return String(rowCount(row, "learners"));
  if (path === "classes.length") return String(rowCount(row, "classes"));
  const value = path.split(".").reduce<JsonValue>((current, key) => current && typeof current === "object" && !Array.isArray(current) && !(current instanceof Date) ? (current as JsonRow)[key] : undefined, row);
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date || /At$/.test(path) || path === "startsAt") return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en", { dateStyle: "medium", ...(path === "startsAt" ? { timeStyle: "short" as const } : {}), timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(String(value)));
  if (typeof value === "string" && ["ACTIVE", "ARCHIVED", "SCHEDULED", "COMPLETED", "CANCELLED", "NOT_MARKED", "PRESENT", "ABSENT", "LATE", "EXCUSED", "ASSIGNED", "NEEDS_REVIEW"].includes(value)) return t(value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()));
  return typeof value === "object" ? "—" : String(value);
}

function initials(name: string) { return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function rowCount(row: JsonRow, key: string) { const value = row[key]; return Array.isArray(value) ? value.length : 0; }
function centerLocalValue(value: string | Date) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function WorkspacePage({ section, role }: { section: string; role: string }) {
  const { t } = useLanguage();
  const config = baseConfigs[section];
  if (section === "team") return <TeamPage role={role} />;
  if (section === "settings") return <SettingsPage />;
  if (!config) return <section className="page-content"><h1>{t("Page not found")}</h1><p>{t("That workspace section isn’t available.")}</p></section>;
  return <ResourcePage key={config.resource} config={config} role={role} section={section} />;
}

function ResourcePage({ config, role, section }: { config: Config; role: string; section: string }) {
  const { language, t } = useLanguage();
  const [rows, setRows] = useState<JsonRow[]>([]);
  const [lookups, setLookups] = useState<Record<string, JsonRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState("upcoming");
  const [editing, setEditing] = useState<JsonRow | null>(null);
  const [viewing, setViewing] = useState<JsonRow | null>(null);
  const [rosterGroup, setRosterGroup] = useState<JsonRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<"deleted" | "saved" | null>(null);
  const [error, setError] = useState("");
  const manager = role === "OWNER" || role === "MANAGER";
  const canCreate = manager || ["sessions", "notes", "progress"].includes(config.resource);
  const fields = useMemo(() => config.fields
    .filter((field) => manager || field.name !== "teacherId")
    .map((field) => manager && field.name === "teacherId" ? { ...field, required: true } : field), [config.fields, manager]);
  const editorConfig = useMemo(() => ({ ...config, fields }), [config, fields]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/${config.resource}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load records.");
      setRows((result.data ?? []) as JsonRow[]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load records.");
    } finally { setLoading(false); }
  }, [config.resource]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => {
    const needed = [...new Set(fields.filter((field) => field.kind === "select").map((field) => field.name))];
    const endpoints = needed.some((field) => field === "learnerId") ? ["learners"] : [];
    if (needed.some((field) => field === "groupId")) endpoints.push("groups");
    if (needed.some((field) => field === "gradeId")) endpoints.push("grades");
    if (needed.some((field) => field === "assignedTeacherId" || field === "teacherId")) endpoints.push("team");
    Promise.all(endpoints.map(async (endpoint) => {
      const response = await fetch(`/api/v1/${endpoint}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) return [endpoint, []] as const;
      return [endpoint, endpoint === "team" ? result.data.map((membership: JsonRow) => ({ id: String((membership.user as JsonRow).id), name: String((membership.user as JsonRow).name), role: membership.role })) : result.data] as const;
    })).then((data) => setLookups(Object.fromEntries(data))).catch(() => undefined);
  }, [fields]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (!JSON.stringify(row).toLowerCase().includes(search.toLowerCase())) return false;
    if (config.resource !== "sessions" || scheduleFilter === "all") return true;
    const date = new Date(String(row.startsAt));
    if (scheduleFilter === "today") return centerLocalValue(date).slice(0, 10) === centerLocalValue(new Date()).slice(0, 10);
    return row.status === "SCHEDULED" && new Date(String(row.endsAt)) >= new Date();
  }), [rows, search, scheduleFilter, config.resource]);

  async function remove(row: JsonRow) {
    if (!window.confirm(t("Delete this {item}? This can’t be undone.", { item: t(config.singular) }))) return;
    const response = await fetch(`/api/v1/${config.resource}/${row.id}`, { method: "DELETE" });
    const result = response.status === 204 ? {} : await response.json();
    if (!response.ok) { setError(result.error ?? "Could not delete this record."); return; }
    setRows((current) => current.filter((item) => item.id !== row.id));
    setToast("deleted");
    setTimeout(() => setToast(null), TOAST_DELAY_MS);
  }

  async function markAssignment(row: JsonRow) {
    const next = row.status === "COMPLETED" ? "ASSIGNED" : "COMPLETED";
    const response = await fetch(`/api/v1/assignments/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next, completedAt: next === "COMPLETED" ? new Date().toISOString() : null }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Could not update assignment."); return; }
    await load();
  }

  return <main className="page-content">
    <div className="page-heading"><div><div className="eyebrow">{t("Your teaching workspace")}</div><h1>{t(config.title)}</h1><p>{t(config.description)}</p></div>{canCreate && <button className="button-primary" onClick={() => { setEditing(null); setCreating(true); }}><Plus size={15} /> {t("Add {item}", { item: t(config.singular) })}</button>}</div>
    {error && <div className="auth-error" role="alert" style={{ marginBottom: 14 }}>{t(error)}<button className="button-quiet" aria-label={t("Dismiss error")} onClick={() => setError("")}><X size={13} /></button></div>}
    {section === "schedule" && <div className="workflow-toolbar"><div className="segmented-control" role="group" aria-label={t("Filter sessions")}>{["upcoming", "today", "all"].map((value) => <button key={value} aria-pressed={scheduleFilter === value} onClick={() => setScheduleFilter(value)}>{t(value === "upcoming" ? "Upcoming" : value === "today" ? "Today" : "All sessions")}</button>)}</div><span className="field-hint">{t("Times shown in Vietnam time (UTC+7)")}</span></div>}
    <section className="panel">
      <div className="panel-header"><div><div className="panel-title">{filtered.length} {language === "vi" ? t(config.singular) : `${config.singular}${filtered.length === 1 ? "" : config.resource === "groups" ? "es" : "s"}`}</div><p className="panel-subtitle">{t(sectionCopy[section])}</p></div></div>
      <div className="section-toolbar" style={{ padding: "0 16px 14px" }}><label className="search-field"><Search size={14} /><input aria-label={t(`Search ${config.title}…`)} placeholder={t(`Search ${config.title}…`)} value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      {loading ? (
        <div className="empty-state"><div className="empty-title">{t("Loading your workspace…")}</div></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><config.icon size={19} /></div>
          <div className="empty-title">{search || rows.length ? t("No matching records") : t(`No ${config.title} yet`)}</div>
          <div className="empty-copy">{search || rows.length ? t("Try another search or filter.") : t(sectionCopy[section])}</div>
          {(search || rows.length > 0) && <button className="button-secondary" onClick={() => { setSearch(""); setScheduleFilter("all"); }}>{t("Clear filters")}</button>}
          {canCreate && !search && rows.length === 0 && <button className="button-primary" onClick={() => { setEditing(null); setCreating(true); }}><Plus size={14} /> {t("Add your first {item}", { item: t(config.singular) })}</button>}
        </div>
      ) : (
        <div className="table-wrap"><table className="data-table">
          <thead><tr>{config.columns.map((column) => <th key={column.key}>{t(column.label)}</th>)}<th aria-label={t("Actions")} /></tr></thead>
          <tbody>{filtered.map((row) => <tr key={String(row.id)}>
            {config.columns.map((column, index) => <td key={column.key}>
              {index === 0 && (config.resource === "learners" || config.resource === "groups" || config.resource === "grades") ? (
                <div className="person-cell"><div className="person-avatar">{initials(valueAt(row, column.key, language, t))}</div><div><div className="person-name">{valueAt(row, column.key, language, t)}</div><div className="person-sub">{config.resource === "learners" ? valueAt(row, "email", language, t) : config.resource === "grades" ? (rowCount(row, "classes") ? t("{count} classes", { count: rowCount(row, "classes") }) : t("No classes yet")) : rowCount(row, "learners") ? t("{count} students", { count: rowCount(row, "learners") }) : t("No students yet")}</div></div></div>
              ) : column.key === "learner.name" && row.group && !row.learner ? (
                <span>{String((row.group as JsonRow).name ?? t("Class"))}</span>
              ) : column.key === "status" || column.key === "attendance" ? (
                <span className={`badge ${["CANCELLED", "ABSENT", "NEEDS_REVIEW"].includes(String(row[column.key])) ? "warn" : row[column.key] === "ARCHIVED" ? "muted" : ""}`}>{valueAt(row, column.key, language, t)}</span>
              ) : <span>{valueAt(row, column.key, language, t)}</span>}
            </td>)}
            <td><div style={{ display: "flex", justifyContent: "flex-end", gap: 3 }}>
              <button className="table-action" title={t("View details")} aria-label={t("View details")} onClick={() => setViewing(row)}><Eye size={14} /><span>{t("View")}</span></button>
              {config.resource === "groups" && manager && <button className="table-action" title={t("Manage roster")} aria-label={t("Manage {name} roster", { name: String(row.name) })} onClick={() => setRosterGroup(row)}><UserPlus size={13} /><span>{t("Roster")}</span></button>}
              {config.resource === "assignments" && !manager && <button className="table-action" title={t("Toggle completion")} aria-label={t("Toggle assignment completion")} onClick={() => void markAssignment(row)}><Check size={14} /><span>{t(row.status === "COMPLETED" ? "Reopen" : "Complete")}</span></button>}
              {(manager || ["sessions", "notes", "progress"].includes(config.resource)) && <button className="table-action" title={t("Edit")} aria-label={t("Edit {item}", { item: t(config.singular) })} onClick={() => { setEditing(row); setCreating(true); }}><Pencil size={13} /><span>{t("Edit")}</span></button>}
              {manager && <button className="table-action" title={t("Delete")} aria-label={t("Delete {item}", { item: t(config.singular) })} onClick={() => void remove(row)}><Trash2 size={13} /></button>}
            </div></td>
          </tr>)}</tbody>
        </table></div>
      )}
    </section>
    {viewing && <RecordDetails config={editorConfig} row={viewing} lookups={lookups} onClose={() => setViewing(null)} />}
    {rosterGroup && <GroupRosterDialog group={rosterGroup} onClose={() => setRosterGroup(null)} onChanged={() => void load()} />}
    {creating && <RecordModal config={editorConfig} row={editing} lookups={lookups} onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await load(); setToast("saved"); setTimeout(() => setToast(null), TOAST_DELAY_MS); }} />}
    {toast && <div className="toast" role="status">{t(toast === "deleted" ? "{item} deleted." : "{item} saved.", { item: t(config.singular) })}</div>}
  </main>;
}

function RecordDetails({ config, row, lookups, onClose }: { config: Config; row: JsonRow; lookups: Record<string, JsonRow[]>; onClose: () => void }) {
  const { language, t } = useLanguage();
  function detail(field: Field) {
    if (field.kind === "datetime-local" && row[field.name]) return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(String(row[field.name])));
    const relations: Record<string, string> = { learnerId: "learner", groupId: "group", gradeId: "grade", teacherId: "teacher", assignedTeacherId: "assignedTeacher" };
    const relation = relations[field.name];
    if (relation) {
      const record = row[relation] as JsonRow | undefined;
      if (record?.name) return String(record.name);
      const endpoint = field.name === "learnerId" ? "learners" : field.name === "groupId" ? "groups" : field.name === "gradeId" ? "grades" : "team";
      return String(lookups[endpoint]?.find((item) => item.id === row[field.name])?.name ?? "—");
    }
    return valueAt(row, field.name, language, t);
  }
  return <Modal labelledBy="record-details-heading" onClose={onClose}><header className="modal-head"><h2 id="record-details-heading">{t("View details")} · {t(config.singular)}</h2><button className="modal-close" onClick={onClose} aria-label={t("Close")}><X size={17} /></button></header><div className="modal-body"><dl className="form-grid">{config.fields.map((field) => <div className={`field ${field.full ? "full" : ""}`} key={field.name}><dt>{t(field.label)}</dt><dd style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{detail(field)}</dd></div>)}</dl></div></Modal>;
}

function RecordModal({ config, row, lookups, onClose, onSaved }: { config: Config; row: JsonRow | null; lookups: Record<string, JsonRow[]>; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState<JsonRow>(() => {
    const initial: JsonRow = { ...(row ?? {}) };
    if (!row) for (const field of config.fields) if (field.options?.length) initial[field.name] = field.options[0].value;
    for (const field of config.fields) if (field.kind === "datetime-local" && (typeof initial[field.name] === "string" || initial[field.name] instanceof Date)) initial[field.name] = centerLocalValue(initial[field.name] as string | Date);
    if (config.resource === "sessions") { initial.learnerId ??= ""; initial.groupId ??= ""; }
    if (config.resource === "assignments") { initial.learnerId ??= ""; initial.groupId ??= ""; }
    return initial;
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [targetType, setTargetType] = useState(row?.groupId ? "groupId" : "learnerId");
  const hasTarget = config.resource === "sessions" || config.resource === "assignments";
  const visibleFields = config.fields.filter((field) => !hasTarget || !["learnerId", "groupId"].includes(field.name) || field.name === targetType);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const values = hasTarget ? { ...form, [targetType === "learnerId" ? "groupId" : "learnerId"]: null } : form;
      const payload = recordPayload(config.resource, values, config.fields, Boolean(row));
      if (hasTarget && !payload[targetType]) throw new Error("Choose a student or class.");
      if (config.resource === "sessions" && new Date(String(payload.endsAt)) <= new Date(String(payload.startsAt))) throw new Error("End time must be after start time.");
      const response = await fetch(`/api/v1/${config.resource}${row ? `/${row.id}` : ""}`, { method: row ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save this record.");
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this record."); }
    finally { setBusy(false); }
  }
  function options(field: Field) {
    if (field.name === "learnerId") return (lookups.learners ?? []).map((item) => ({ value: String(item.id), label: String(item.name) }));
    if (field.name === "groupId") return (lookups.groups ?? []).map((item) => ({ value: String(item.id), label: String(item.name) }));
    if (field.name === "gradeId") return (lookups.grades ?? []).map((item) => ({ value: String(item.id), label: String(item.name) }));
    if (field.name === "assignedTeacherId") return (lookups.team ?? []).filter((item) => item.role === "TEACHER").map((item) => ({ value: String(item.id), label: String(item.name) }));
    if (field.name === "teacherId") return (lookups.team ?? []).map((item) => ({ value: String(item.id), label: String(item.name) }));
    return field.options ?? [];
  }
  return <Modal labelledBy="record-heading" onClose={onClose}><header className="modal-head"><div><h2 id="record-heading">{t(row ? "Update" : "Add")} {t(config.singular)}</h2><p>{t("Details are saved to your center workspace.")}</p></div><button className="modal-close" onClick={onClose} aria-label={t("Close")}><X size={17} /></button></header><form onSubmit={submit} className="modal-body"><p className="field-hint">{t("Fields marked * are required.")}</p>{hasTarget && <fieldset className="target-choice"><legend>{t("Who is this for?")}</legend><div className="segmented-control">{["learnerId", "groupId"].map((value) => <button type="button" key={value} aria-pressed={targetType === value} onClick={() => setTargetType(value)}>{t(value === "learnerId" ? "One student" : "Whole class")}</button>)}</div></fieldset>}{config.resource === "sessions" && <p className="field-hint">{t("Times shown in Vietnam time (UTC+7)")}</p>}<div className="form-grid">{visibleFields.map((field) => <div className={`field ${field.full ? "full" : ""}`} key={field.name}><label htmlFor={field.name}>{t(field.label)}{field.required || (hasTarget && field.name === targetType) ? " *" : ""}</label>{field.kind === "textarea" ? <textarea id={field.name} value={String(form[field.name] ?? "")} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} required={field.required || (hasTarget && field.name === targetType)} /> : field.kind === "select" ? <select id={field.name} value={String(form[field.name] ?? "")} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} required={field.required || (hasTarget && field.name === targetType)}><option value="">{t("Choose {item}…", { item: t(field.label.toLowerCase()) })}</option>{options(field).map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}</select> : <input id={field.name} type={field.kind ?? "text"} step={field.kind === "number" ? "any" : undefined} value={String(form[field.name] ?? "")} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} required={field.required || (hasTarget && field.name === targetType)} />}{field.kind === "select" && !field.options && options(field).length === 0 && <p className="field-hint">{t("No options available yet.")} <Link href={field.name === "gradeId" ? "/grades" : field.name === "groupId" ? "/groups" : field.name === "learnerId" ? "/learners" : "/team"}>{t(field.name === "gradeId" ? "Set up grades" : field.name === "groupId" ? "Set up classes" : field.name === "learnerId" ? "Check students" : "Check team")}</Link></p>}</div>)}</div>{error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{t(error)}</p>}<div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>{t("Cancel")}</button><button className="button-primary" disabled={busy}>{busy ? t("Saving…") : row ? t("Save changes") : t("Add {item}", { item: t(config.singular) })}</button></div></form></Modal>;
}

function GroupRosterDialog({ group, onClose, onChanged }: { group: JsonRow; onClose: () => void; onChanged: () => void }) {
  const { t } = useLanguage();
  const [learners, setLearners] = useState<JsonRow[]>([]);
  const [available, setAvailable] = useState<JsonRow[]>([]);
  const [learnerId, setLearnerId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [groupResponse, learnersResponse] = await Promise.all([fetch(`/api/v1/groups/${group.id}/learners`), fetch("/api/v1/learners")]);
    const [groupResult, learnersResult] = await Promise.all([groupResponse.json(), learnersResponse.json()]);
      if (!groupResponse.ok) throw new Error(groupResult.error ?? "Could not load class roster.");
      if (!learnersResponse.ok) throw new Error(learnersResult.error ?? "Could not load students.");
    setLearners(groupResult.data);
    setAvailable(learnersResult.data.filter((learner: JsonRow) => !groupResult.data.some((member: JsonRow) => member.id === learner.id)));
  }, [group.id]);
  useEffect(() => { void Promise.resolve().then(load).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load class roster.")); }, [load]);
  async function addLearner() {
    if (!learnerId) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/groups/${group.id}/learners`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ learnerId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not add student.");
      setLearnerId(""); await load(); onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add student."); }
    finally { setBusy(false); }
  }
  async function removeLearner(id: string) {
    const response = await fetch(`/api/v1/groups/${group.id}/learners?learnerId=${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = response.status === 204 ? {} : await response.json();
    if (!response.ok) setError(result.error ?? "Could not remove student."); else { await load(); onChanged(); }
  }
  return <Modal labelledBy="roster-heading" onClose={onClose}><header className="modal-head"><div><h2 id="roster-heading">{String(group.name)} · {t("Class roster")}</h2><p>{t("Add students who belong to this class.")}</p></div><button className="modal-close" onClick={onClose} aria-label={t("Close")}><X size={17} /></button></header><div className="modal-body"><div className="field"><label htmlFor="roster-learner">{t("Add a student")}</label><div style={{ display: "flex", gap: 8 }}><select id="roster-learner" value={learnerId} onChange={(event) => setLearnerId(event.target.value)} style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 9, padding: "0 10px" }}><option value="">{t("Choose a student…")}</option>{available.map((learner) => <option key={String(learner.id)} value={String(learner.id)}>{String(learner.name)}</option>)}</select><button className="button-primary" type="button" disabled={busy || !learnerId} onClick={() => void addLearner()}><Plus size={14} /> {t("Add")}</button></div></div>{error && <p className="form-error" style={{ marginTop: 10 }}>{t(error)}</p>}<div style={{ marginTop: 18 }}><div className="panel-title" style={{ marginBottom: 8 }}>{t("Current students · {count}", { count: learners.length })}</div>{learners.length ? learners.map((learner) => <div className="team-row" key={String(learner.id)} style={{ paddingLeft: 0, paddingRight: 0 }}><div className="person-avatar">{initials(String(learner.name))}</div><div className="team-info"><strong>{String(learner.name)}</strong><span>{String(learner.level ?? t("Level not set"))}</span></div><button className="table-action" aria-label={t("Remove {name} from class", { name: String(learner.name) })} onClick={() => void removeLearner(String(learner.id))}><Trash2 size={13} /></button></div>) : <p className="panel-subtitle">{t("No students in this class yet.")}</p>}</div></div></Modal>;
}

function TeamPage({ role }: { role: string }) {
  const { t } = useLanguage();
  const [team, setTeam] = useState<JsonRow[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("TEACHER");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const manager = role === "OWNER" || role === "MANAGER";
  const load = useCallback(async () => {
    const response = await fetch("/api/v1/team", { cache: "no-store" });
    const result = await response.json();
    if (response.ok) setTeam(result.data);
    else setError(result.error ?? "Could not load your team.");
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/v1/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role: inviteRole }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not send invitation.");
      setMessage(email); setEmail("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send invitation."); }
    finally { setBusy(false); }
  }
  async function changeRole(userId: string, nextRole: string) {
    const response = await fetch(`/api/v1/team/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: nextRole }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Could not update this role."); else await load();
  }
  async function remove(userId: string, name: string) {
    if (!window.confirm(t("Remove {name} from the center?", { name }))) return;
    const response = await fetch(`/api/v1/team/${userId}`, { method: "DELETE" });
    const result = response.status === 204 ? {} : await response.json();
    if (!response.ok) setError(result.error ?? "Could not remove this team member."); else await load();
  }
  return <main className="page-content"><div className="page-heading"><div><div className="eyebrow">{t("Center workspace")}</div><h1>{t("Your teaching team")}</h1><p>{t("Bring your center’s people together, with the right access for each role.")}</p></div></div>
    {error && <div role="alert" className="auth-error" style={{ marginBottom: 14 }}>{t(error)}</div>}{message && <div role="status" className="auth-error" style={{ color: "#386d52", background: "#edf5ef", marginBottom: 14 }}>{t("Invitation sent to {email}.", { email: message })}</div>}
    <div className="dashboard-grid" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(270px,.7fr)" }}><section className="panel"><div className="panel-header"><div><div className="panel-title">{t("Center members")}</div><p className="panel-subtitle">{t("Owners and managers see all center records. Teachers see their assignments.")}</p></div><span className="badge">{team.length} {t("members")}</span></div>{team.map((member) => { const user = (member.user ?? {}) as JsonRow; const userId = String(user.id ?? ""); const userName = String(user.name ?? t("Team member")); const userEmail = String(user.email ?? ""); const memberRole = String(member.role ?? "TEACHER"); return <div className="team-row" key={String(member.id)}><div className="profile-avatar">{initials(userName)}</div><div className="team-info"><strong>{userName}</strong><span>{userEmail}</span></div>{memberRole === "OWNER" ? <span className="badge">{t("Owner")}</span> : manager ? <><select aria-label={t("Role for {name}", { name: userName })} value={memberRole} onChange={(event) => void changeRole(userId, event.target.value)}><option value="MANAGER">{t("Manager")}</option><option value="TEACHER">{t("Teacher")}</option></select><button className="table-action" aria-label={t("Remove {name}", { name: userName })} onClick={() => void remove(userId, userName)}><Trash2 size={13} /></button></> : <span className="badge muted">{t(memberRole.toLowerCase())}</span>}</div>; })}</section>
      {manager ? <section className="panel"><div className="panel-header"><div><div className="panel-title">{t("Invite a colleague")}</div><p className="panel-subtitle">{t("They’ll get a secure link that expires in seven days.")}</p></div><UserPlus size={17} color="var(--green)" /></div><form onSubmit={invite} style={{ padding: "0 18px 19px", display: "grid", gap: 12 }}><div className="field"><label htmlFor="invite-email">{t("Email address")}</label><input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder={t("colleague@example.com")} /></div><div className="field"><label htmlFor="invite-role">{t("Role")}</label><select id="invite-role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="TEACHER">{t("Teacher")}</option><option value="MANAGER">{t("Manager")}</option></select></div><button className="button-primary" disabled={busy}><Send size={13} />{busy ? t("Sending…") : t("Send invitation")}</button></form></section> : <section className="panel settings-card"><h3>{t("Working together")}</h3><p>{t("Your center manager can invite colleagues and manage team access.")}</p></section>}</div>
  </main>;
}

function SettingsPage() {
  const { t } = useLanguage();
  const [center, setCenter] = useState<JsonRow | null>(null);
  useEffect(() => { fetch("/api/v1/setup").then((response) => response.json()).then((result) => setCenter(result.center)).catch(() => undefined); }, []);
  return <main className="page-content"><div className="page-heading"><div><div className="eyebrow">{t("Center workspace")}</div><h1>{t("Center settings")}</h1><p>{t("A few details about how your workspace is set up.")}</p></div></div><section className="panel settings-card" style={{ maxWidth: 620 }}><h3>{t("Workspace details")}</h3><p>{t("These details are used across your teaching workspace.")}</p><div className="settings-line"><span>{t("Center name")}</span><strong>{String(center?.name ?? t("Loading…"))}</strong></div><div className="settings-line"><span>{t("Default timezone")}</span><strong>{String(center?.timezone ?? "Asia/Ho_Chi_Minh")}</strong></div><div className="settings-line"><span>{t("Access model")}</span><strong>{t("Shared center")}</strong></div><div className="settings-line"><span>{t("Teaching records")}</span><strong>{t("Private to your center")}</strong></div></section></main>;
}
