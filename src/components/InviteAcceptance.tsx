"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { LanguageSelect, useLanguage } from "@/components/LanguageProvider";

type Invitation = { email: string; role: string; centerName: string };

export function InviteAcceptance({ token }: { token: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const session = authClient.useSession();

  useEffect(() => {
    fetch(`/api/v1/invitations/${token}`).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Invitation unavailable.");
      setInvitation(result.data);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Invitation unavailable."));
  }, [token, t]);

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/invitations/${token}`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not accept this invitation.");
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-main" style={{ minHeight: "100vh", background: "#f4f7f1" }}><section className="setup-card">
    <div className="setup-language"><LanguageSelect /></div>
    <div className="brand" style={{ padding: "0 0 25px" }}><div className="brand-mark"><BookOpenCheck size={19} /></div><div><div className="brand-name">teach<span style={{ color: "var(--green)" }}>.</span></div><div className="brand-caption">{t("A calmer way to teach")}</div></div></div>
    <div className="eyebrow">{t("Team invitation")}</div>
    {invitation ? <><h1>{t("Join {center}", { center: invitation.centerName })}</h1><p>{t("You’ve been invited as a {role}. Accept with {email} to join the center workspace.", { role: t(invitation.role.toLowerCase()), email: invitation.email })}</p>{session.data?.user ? <button className="button-primary auth-submit" disabled={busy} onClick={accept}>{busy ? t("Joining…") : t("Accept invitation")}</button> : <><p>{t("Activate your account or sign in with the invited email to continue.")}</p><div style={{ display: "flex", gap: 9 }}><Link className="button-primary" href={`/register?invite=${token}`}>{t("Activate account")}</Link><Link className="button-secondary" href={`/login?invite=${token}`}>{t("Sign in")}</Link></div></>}</> : <><h1>{error ? t("Invitation unavailable") : t("Checking invitation…")}</h1><p>{error ? t(error) : t("Just a moment while we look up this invitation.")}</p></>}
    {error && invitation && <div role="alert" className="auth-error">{t(error)}</div>}
  </section></main>;
}
