"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, FolderOpen, Plus, Trash2, Upload } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type Scope = "COMMON" | "GRADE" | "CLASS";
type Grade = { id: string; name: string };
type ClassItem = { id: string; name: string; grade: { name: string } | null };
type DocumentItem = {
  id: string;
  scope: Scope;
  title: string;
  description: string | null;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  grade: Grade | null;
  group: ClassItem | null;
};
type Filter = "ALL" | Scope;

const emptyData = { documents: [] as DocumentItem[], grades: [] as Grade[], classes: [] as ClassItem[] };

export function LibraryPage({ role }: { role: string }) {
  const { language, t } = useLanguage();
  const [data, setData] = useState(emptyData);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [scope, setScope] = useState<Scope>("COMMON");
  const [gradeId, setGradeId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const manager = role === "OWNER" || role === "MANAGER";

  const load = useCallback(async () => {
    const response = await fetch("/api/v1/library", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load the library.");
    setData(result.data);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load the library.")).finally(() => setLoading(false));
  }, [load]);

  const visibleDocuments = useMemo(() => filter === "ALL" ? data.documents : data.documents.filter((item) => item.scope === filter), [data.documents, filter]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!file) { setError("Choose a document to upload."); return; }
    setBusy(true); setError(""); setNotice("");
    const form = new FormData();
    form.set("title", title);
    form.set("description", description);
    form.set("scope", scope);
    if (scope === "GRADE") form.set("gradeId", gradeId);
    if (scope === "CLASS") form.set("groupId", groupId);
    form.set("file", file);
    try {
      const response = await fetch("/api/v1/library", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not upload this document.");
      setTitle(""); setDescription(""); setFile(null); setScope("COMMON"); setGradeId(""); setGroupId("");
      formElement.reset();
      setNotice("Document added to the library.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload this document.");
    } finally { setBusy(false); }
  }

  async function remove(document: DocumentItem) {
    if (!window.confirm(t("Delete {item}? This can’t be undone.", { item: document.title }))) return;
    setBusyId(document.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/v1/library/${document.id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Could not delete this document.");
      }
      setNotice("Document deleted.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this document.");
    } finally { setBusyId(""); }
  }

  function location(document: DocumentItem) {
    if (document.scope === "COMMON") return t("Common library");
    if (document.scope === "GRADE") return t("Grade · {name}", { name: document.grade?.name ?? "—" });
    return document.group?.grade
      ? t("Class · {grade} · {name}", { grade: document.group.grade.name, name: document.group.name })
      : t("Class · {name}", { name: document.group?.name ?? "—" });
  }

  return <main className="page-content">
    <div className="page-heading"><div><div className="eyebrow">{t("Teaching workspace")}</div><h1>{t("Document library")}</h1><p>{t("Share teaching materials with everyone, a grade, or one class.")}</p></div></div>
    {error && <div className="auth-error" role="alert">{t(error)}<button className="button-quiet" onClick={() => setError("")} aria-label={t("Dismiss error")}>×</button></div>}
    {notice && <div className="transfer-notice" role="status">{t(notice)}</div>}

    {manager && <section className="panel library-upload-panel">
      <div className="panel-header"><div><div className="panel-title">{t("Add a document")}</div><p className="panel-subtitle">{t("PDF, Word, PowerPoint, text, or image · up to 15 MB")}</p></div><div className="transfer-icon"><Upload size={17} /></div></div>
      <form className="library-upload-form" onSubmit={(event) => void upload(event)}>
        <div className="field"><label htmlFor="library-title">{t("Document title")}</label><input id="library-title" required minLength={2} maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} /></div>
        <div className="field"><label htmlFor="library-file">{t("Choose a file")}</label><input id="library-file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
        <div className="field"><label htmlFor="library-scope">{t("Share with")}</label><select id="library-scope" value={scope} onChange={(event) => { setScope(event.target.value as Scope); setGradeId(""); setGroupId(""); }}><option value="COMMON">{t("Everyone at the center")}</option><option value="GRADE">{t("One grade")}</option><option value="CLASS">{t("One class")}</option></select></div>
        {scope === "GRADE" && <div className="field"><label htmlFor="library-grade">{t("Grade")}</label><select id="library-grade" required value={gradeId} onChange={(event) => setGradeId(event.target.value)}><option value="">{t("Choose a grade…")}</option>{data.grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>}
        {scope === "CLASS" && <div className="field"><label htmlFor="library-class">{t("Class")}</label><select id="library-class" required value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">{t("Choose a class…")}</option>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.grade ? `${item.grade.name} · ` : ""}{item.name}</option>)}</select></div>}
        <div className="field library-description"><label htmlFor="library-description">{t("Description")} <span className="optional-label">{t("Optional")}</span></label><textarea id="library-description" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="library-upload-action"><button className="button-primary" disabled={busy || !file || (scope === "GRADE" && !gradeId) || (scope === "CLASS" && !groupId)}><Plus size={14} />{busy ? t("Uploading…") : t("Add to library")}</button></div>
      </form>
    </section>}

    <section className="panel library-browser">
      <div className="library-toolbar"><div><div className="panel-title">{t("Shared documents")}</div><p className="panel-subtitle">{t("Documents available to your teaching team")}</p></div><div className="library-filters" role="group" aria-label={t("Filter documents")}>
        {(["ALL", "COMMON", "GRADE", "CLASS"] as Filter[]).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{t(value === "ALL" ? "All" : value === "COMMON" ? "Common" : value === "GRADE" ? "Grades" : "Classes")}</button>)}
      </div></div>
      {loading ? <div className="library-empty"><FolderOpen size={20} /><span>{t("Loading your library…")}</span></div> : visibleDocuments.length ? <div className="library-document-list">{visibleDocuments.map((document) => <article className="library-document" key={document.id}>
        <div className="library-file-icon"><FileText size={18} /></div><div className="library-document-copy"><strong>{document.title}</strong><span>{location(document)} · {formatSize(document.size)} · {new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(document.createdAt))}</span>{document.description && <p>{document.description}</p>}<small>{document.fileName}</small></div>
        <div className="library-document-actions"><a className="button-secondary" href={`/api/v1/library/${document.id}`}><Download size={13} />{t("Download")}</a>{manager && <button className="table-action" disabled={busyId === document.id} title={t("Delete")} aria-label={t("Delete {item}", { item: document.title })} onClick={() => void remove(document)}><Trash2 size={14} /></button>}</div>
      </article>)}</div> : <div className="library-empty"><FolderOpen size={20} /><div><strong>{t("No documents here yet")}</strong><span>{manager ? t("Add a document to share it with your teaching team.") : t("Your center library is ready for shared teaching materials.")}</span></div></div>}
    </section>
  </main>;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
