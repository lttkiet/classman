"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { BookOpenCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { LanguageSelect, useLanguage } from "@/components/LanguageProvider";

type Mode = "login" | "register" | "forgot" | "reset";

export function AuthForm({ initialMode }: { initialMode: Mode }) {
  const { t } = useLanguage();
  const params = useSearchParams();
  const invite = params.get("invite");
  const token = params.get("token");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const destination = invite ? `/invite/${invite}` : "/dashboard";

  useEffect(() => {
    if (mode !== "register" || !invite) return;
    fetch(`/api/v1/invitations/${invite}`).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "This invitation is invalid or has expired.");
      setInviteEmail(result.data.email);
      setEmail(result.data.email);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "This invitation is unavailable."));
  }, [invite, mode, t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "login") {
        const result = await authClient.signIn.email({ email, password, callbackURL: destination });
        if (result.error) throw new Error(result.error.message ?? "Unable to sign in.");
        window.location.assign(destination);
      } else if (mode === "register") {
        if (!invite || !inviteEmail) throw new Error("Open the invitation link from the center administrator to create an account.");
        const response = await fetch("/api/auth/sign-up/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-center-invitation": invite },
          body: JSON.stringify({ name, email, password, callbackURL: destination }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? result.error?.message ?? "Unable to create your account.");
        setMessage("Check your inbox for a verification link. We’ll take you to your workspace after you verify your email.");
      } else if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
        if (result.error) throw new Error(result.error.message ?? "Unable to send the reset email.");
        setMessage("If an account uses that email, a password reset link is on its way.");
      } else {
        if (!token) throw new Error("That password reset link is missing its token.");
        const result = await authClient.resetPassword({ newPassword: password, token });
        if (result.error) throw new Error(result.error.message ?? "Unable to reset your password.");
        setMessage("Your password is updated. You can sign in now.");
        setMode("login");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "login" ? "Welcome back" : mode === "register" ? "Activate your account" : mode === "forgot" ? "Reset your password" : "Choose a new password";
  const subtitle = mode === "login" ? "Sign in to see what’s happening at your center." : mode === "register" ? "Your center administrator invited you to join the teaching team." : mode === "forgot" ? "We’ll email you a secure link to choose a new password." : "Choose a strong password for your account.";

  return <main className="auth-wrap">
    <aside className="auth-aside">
      <div className="brand"><div className="brand-mark"><BookOpenCheck size={19} /></div><div><div className="brand-name" style={{ color: "white" }}>Classman</div><div className="brand-caption">{t("A calmer way to teach")}</div></div></div>
      <div className="auth-aside-main"><div className="hero-kicker">{t("Made for the moments that matter")}</div><h1>{t("More time for teaching. Less time chasing details.")}</h1><p>{t("Bring your students, classes, lessons, and teaching team together in one thoughtful workspace.")}</p></div>
      <div className="auth-quote">{t("“I can see my whole week at a glance and still give each student the attention they deserve.”")}<strong>— {t("A note from the teaching desk")}</strong></div>
    </aside>
    <section className="auth-main">
      <div className="auth-card">
        <div className="auth-language"><LanguageSelect /></div>
        <div className="brand auth-mobile-brand"><div className="brand-mark"><BookOpenCheck size={19} /></div><div><div className="brand-name">Classman</div><div className="brand-caption">{t("A calmer way to teach")}</div></div></div>
        <div className="eyebrow">{t("Your teaching workspace")}</div><h2>{t(title)}</h2><p>{t(subtitle)}</p>
        {mode === "register" && !invite ? <div role="status" className="auth-error">{t("Accounts are created by invitation. Ask your center administrator to invite you.")}</div> : <form onSubmit={submit} className="auth-fields">
          {mode === "register" && invite && <div className="field"><label htmlFor="name">{t("Your name")}</label><input id="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} placeholder="Jamie Parker" /></div>}
          {mode !== "reset" && <div className="field"><label htmlFor="email">{t("Email address")}</label><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} readOnly={mode === "register"} required placeholder="you@example.com" /></div>}
          {(mode === "login" || mode === "register" || mode === "reset") && <div className="field"><label htmlFor="password">{t(mode === "reset" ? "New password" : "Password")}</label><input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} placeholder={t("At least 8 characters")} /></div>}
          {mode === "login" && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -4 }}><button type="button" className="button-quiet" onClick={() => setMode("forgot")}>{t("Forgot password?")}</button></div>}
          <button type="submit" className="button-primary auth-submit" disabled={busy || (mode === "register" && (!invite || !inviteEmail))}>{busy ? t("Please wait…") : t(mode === "login" ? "Sign in" : mode === "register" ? "Activate account" : mode === "forgot" ? "Send reset link" : "Update password")}</button>
        </form>}
        {error && <div role="alert" className="auth-error">{t(error)}</div>}
        {message && <div role="status" className="auth-error" style={{ color: "#386d52", background: "#edf5ef" }}>{t(message)}</div>}
        <div className="auth-switch">{mode === "login" ? invite ? <>{t("Already invited? ")}<Link href={`/register?invite=${invite}`}>{t("Activate your account")}</Link></> : t("Ask your center administrator for an invitation.") : mode === "register" ? <>{t("Already have an account? ")}<Link href={`/login?invite=${invite}`}>{t("Sign in")}</Link></> : <button type="button" className="button-quiet" onClick={() => setMode("login")}>{t("Back to sign in")}</button>}</div>
      </div>
    </section>
  </main>;
}
