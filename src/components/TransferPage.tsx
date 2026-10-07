"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowRight, ArrowRightLeft, Check, Clock3, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type Person = { id: string; name: string };
type Learner = { id: string; name: string; level: string | null };
type Transfer = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  message: string | null;
  responseMessage: string | null;
  createdAt: string;
  respondedAt: string | null;
  learner: Learner;
  requester: Person;
  targetTeacher: Person;
};
type TransferData = { requests: Transfer[]; learners: Learner[]; teachers: Person[] };

const statusLabel: Record<Transfer["status"], string> = { PENDING: "Awaiting response", ACCEPTED: "Accepted", DECLINED: "Declined", CANCELLED: "Cancelled" };

export function TransferPage({ role, userId }: { role: string; userId: string }) {
  const { t } = useLanguage();
  const [data, setData] = useState<TransferData>({ requests: [], learners: [], teachers: [] });
  const [learnerId, setLearnerId] = useState("");
  const [targetTeacherId, setTargetTeacherId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/v1/transfers", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load transfer requests.");
    setData(result.data);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(load).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load transfer requests.");
    });
    return () => { active = false; };
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/v1/transfers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ learnerId, targetTeacherId, message }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not send request.");
      setLearnerId(""); setTargetTeacherId(""); setMessage(""); setNotice("Transfer request sent."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not send request."); }
    finally { setBusy(false); }
  }

  async function respond(id: string, action: "accept" | "decline" | "cancel") {
    setBusyId(id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/v1/transfers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update request.");
      setNotice(action === "accept" ? "Student transfer accepted." : action === "decline" ? "Request declined." : "Request cancelled."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update request."); }
    finally { setBusyId(""); }
  }

  const incoming = data.requests.filter((request) => request.targetTeacher.id === userId);
  const outgoing = data.requests.filter((request) => request.requester.id === userId && request.status === "PENDING");
  const history = data.requests.filter((request) => request.status !== "PENDING");

  return <main className="page-content">
    <div className="page-heading"><div><div className="eyebrow">{t("Teaching team")}</div><h1>{t("Student transfers")}</h1><p>{t("Hand a student’s care to a teammate with their agreement.")}</p></div></div>
    {error && <div className="auth-error" role="alert">{t(error)}<button className="button-quiet" onClick={() => setError("")} aria-label={t("Dismiss error")}><X size={13} /></button></div>}
    {notice && <div className="transfer-notice" role="status"><Check size={14} />{t(notice)}</div>}
    {role === "TEACHER" && <section className="panel transfer-compose">
      <div className="panel-header"><div><div className="panel-title">{t("Request a handoff")}</div><p className="panel-subtitle">{t("The new teacher must accept before the student changes hands.")}</p></div><div className="transfer-icon"><ArrowRightLeft size={17} /></div></div>
      <form className="transfer-form" onSubmit={(event) => void create(event)}>
        <div className="field"><label htmlFor="transfer-learner">{t("Student")}</label><select id="transfer-learner" required value={learnerId} onChange={(event) => setLearnerId(event.target.value)}><option value="">{t("Choose a student…")}</option>{data.learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.name}{learner.level ? ` · ${learner.level}` : ""}</option>)}</select></div>
        <div className="field"><label htmlFor="transfer-teacher">{t("Transfer to")}</label><select id="transfer-teacher" required value={targetTeacherId} onChange={(event) => setTargetTeacherId(event.target.value)}><option value="">{t("Choose a teacher…")}</option>{data.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></div>
        <div className="field transfer-message"><label htmlFor="transfer-message">{t("Message")} <span className="optional-label">{t("Optional")}</span></label><textarea id="transfer-message" maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t("Add context or a handoff note for your teammate.")} /></div>
        <div className="transfer-submit"><button className="button-primary" disabled={busy || !learnerId || !targetTeacherId}>{busy ? t("Sending…") : t("Send request")}<ArrowRight size={14} /></button></div>
      </form>
    </section>}

    {role === "TEACHER" ? <div className="transfer-columns">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">{t("Needs your response")} <span className="count-badge">{incoming.filter((item) => item.status === "PENDING").length}</span></div><p className="panel-subtitle">{t("Requests addressed to you")}</p></div></div><div className="transfer-list">{incoming.filter((item) => item.status === "PENDING").length ? incoming.filter((item) => item.status === "PENDING").map((item) => <TransferCard key={item.id} request={item} action={respond} busy={busyId === item.id} incoming />) : <div className="transfer-empty"><Clock3 size={17} /><span>{t("No requests waiting for you.")}</span></div>}</div></section>
      <section className="panel"><div className="panel-header"><div><div className="panel-title">{t("Your pending requests")}</div><p className="panel-subtitle">{t("Track handoffs you’ve sent")}</p></div></div><div className="transfer-list">{outgoing.length ? outgoing.map((item) => <TransferCard key={item.id} request={item} action={respond} busy={busyId === item.id} />) : <div className="transfer-empty"><ArrowRightLeft size={17} /><span>{t("No transfer requests waiting for a response.")}</span></div>}</div></section>
    </div> : <section className="panel"><div className="panel-header"><div><div className="panel-title">{t("Center transfer activity")}</div><p className="panel-subtitle">{t("Requests across your center")}</p></div></div><div className="transfer-list">{data.requests.length ? data.requests.map((item) => <TransferCard key={item.id} request={item} action={respond} busy={false} readOnly />) : <div className="transfer-empty"><ArrowRightLeft size={17} /><span>{t("No transfer activity yet.")}</span></div>}</div></section>}

    {role === "TEACHER" && history.length > 0 && <section className="panel transfer-history"><div className="panel-header"><div><div className="panel-title">{t("Recent history")}</div><p className="panel-subtitle">{t("Completed, declined, or cancelled requests")}</p></div></div><div className="transfer-list">{history.map((item) => <TransferCard key={item.id} request={item} action={respond} busy={false} compact />)}</div></section>}
  </main>;
}

function TransferCard({ request, action, busy, incoming = false, compact = false, readOnly = false }: { request: Transfer; action: (id: string, action: "accept" | "decline" | "cancel") => Promise<void>; busy: boolean; incoming?: boolean; compact?: boolean; readOnly?: boolean }) {
  const { language, t } = useLanguage();
  const pending = request.status === "PENDING";
  return <article className={`transfer-card ${compact ? "compact" : ""}`}>
    <div className="transfer-card-main"><div className="person-avatar">{request.learner.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div className="transfer-copy"><strong>{request.learner.name}</strong><span>{t(incoming ? "From {name}" : "To {name}", { name: incoming ? request.requester.name : request.targetTeacher.name })} · {new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(request.createdAt))}</span>{request.message && <p>{request.message}</p>}{request.responseMessage && <p className="transfer-response">{t("Response: {message}", { message: request.responseMessage })}</p>}</div><span className={`transfer-status ${request.status.toLowerCase()}`}>{t(statusLabel[request.status])}</span></div>
    {pending && !readOnly && <div className="transfer-actions">{incoming ? <><button className="button-primary" disabled={busy} onClick={() => void action(request.id, "accept")}><Check size={13} />{t("Accept")}</button><button className="button-secondary" disabled={busy} onClick={() => void action(request.id, "decline")}><X size={13} />{t("Decline")}</button></> : <button className="button-secondary" disabled={busy} onClick={() => void action(request.id, "cancel")}><X size={13} />{t("Cancel request")}</button>}</div>}
  </article>;
}
