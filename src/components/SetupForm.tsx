"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck } from "lucide-react";
import { LanguageSelect, useLanguage } from "@/components/LanguageProvider";

export function SetupForm({ name }: { name: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [centerName, setCenterName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: centerName }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create your center.");
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  return <section className="setup-card">
    <div className="setup-language"><LanguageSelect /></div>
    <div className="brand" style={{ padding: "0 0 25px" }}><div className="brand-mark"><BookOpenCheck size={19} /></div><div><div className="brand-name">teach<span style={{ color: "var(--green)" }}>.</span></div><div className="brand-caption">{t("A calmer way to teach")}</div></div></div>
    <div className="eyebrow">{t("Let’s set up your workspace")}</div><h1>{t("Welcome, {name}.", { name: name.split(" ")[0] })}</h1><p>{t("Give your tutoring center a name. You’ll be its owner, and can invite your team once you’re in.")}</p>
    <form onSubmit={submit} className="auth-fields"><div className="field"><label htmlFor="center">{t("Center name")}</label><input id="center" value={centerName} onChange={(event) => setCenterName(event.target.value)} required minLength={2} maxLength={120} placeholder={t("e.g. Bright Path Language Studio")} /></div><button className="button-primary auth-submit" disabled={busy}>{busy ? t("Setting up…") : t("Create my workspace")}</button></form>
    {error && <div role="alert" className="auth-error">{t(error)}</div>}
  </section>;
}
