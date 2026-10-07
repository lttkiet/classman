"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRightLeft, BookOpenCheck, CalendarDays, ChartNoAxesColumnIncreasing, ClipboardList, Files,
  GraduationCap, LayoutDashboard, LogOut, Menu, NotebookPen, Settings2, Users, UsersRound, X,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { LanguageSelect, useLanguage } from "@/components/LanguageProvider";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/grades", label: "Grades", icon: GraduationCap },
  { href: "/learners", label: "Students", icon: GraduationCap },
  { href: "/groups", label: "Classes", icon: UsersRound },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/lessons", label: "Lesson library", icon: NotebookPen },
  { href: "/library", label: "Library", icon: Files },
  { href: "/notes", label: "Session notes", icon: NotebookPen },
  { href: "/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumnIncreasing },
  { href: "/transfers", label: "Transfers", icon: ArrowRightLeft },
];

type Props = { children: React.ReactNode; userName: string; centerName: string; role: string };

export function PortalShell({ children, userName, centerName, role }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { language, t } = useLanguage();
  const page = t(nav.find((item) => item.href === pathname)?.label ?? (pathname === "/team" ? "Team" : pathname === "/settings" ? "Settings" : "Workspace"));
  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }
  return <div className="portal-shell">
    <div className={`mobile-nav-backdrop ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} />
    <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark"><BookOpenCheck size={19} /></div><div><div className="brand-name">teach<span style={{ color: "var(--green)" }}>.</span></div><div className="brand-caption">{t("A calmer way to teach")}</div></div><button className="button-quiet" onClick={() => setMenuOpen(false)} aria-label={t("Close menu")} style={{ display: "none" }}><X size={17} /></button></div>
      <div className="center-switcher"><div className="center-avatar">{centerName.slice(0, 1).toUpperCase()}</div><div className="center-info"><div className="center-name">{centerName}</div><div className="center-label">{t("Tutoring center")}</div></div></div>
      <div className="nav-label">{t("Workspace")}</div>
      <nav className="nav-list">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${pathname === href ? "active" : ""}`} onClick={() => setMenuOpen(false)}><Icon className="nav-icon" strokeWidth={1.8} />{t(label)}</Link>)}</nav>
      {(role === "OWNER" || role === "MANAGER") && <><div className="nav-label" style={{ marginTop: 24 }}>{t("Center")}</div><nav className="nav-list"><Link href="/team" className={`nav-link ${pathname === "/team" ? "active" : ""}`} onClick={() => setMenuOpen(false)}><Users className="nav-icon" strokeWidth={1.8} />{t("Team")}</Link><Link href="/settings" className={`nav-link ${pathname === "/settings" ? "active" : ""}`} onClick={() => setMenuOpen(false)}><Settings2 className="nav-icon" strokeWidth={1.8} />{t("Settings")}</Link></nav></>}
      <div className="sidebar-bottom"><div className="help-card"><div className="help-title">{t("A little help goes a long way")}</div><div className="help-copy">{t("Keep your teaching week thoughtful and your admin light.")}</div><Link href="/lessons" className="help-link">{t("Explore lesson library →")}</Link></div><div className="profile-row"><div className="profile-avatar">{userName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div className="profile-meta"><div className="profile-name">{userName}</div><div className="profile-role">{t(role.toLowerCase())}</div></div><button className="signout" onClick={signOut} aria-label={t("Sign out")} title={t("Sign out")}><LogOut size={15} /></button></div></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div style={{ display: "flex", alignItems: "center", gap: 12 }}><button className="icon-button mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label={t("Open menu")}><Menu size={16} /></button><div className="crumb"><span>Classman</span><span>/</span><strong>{page}</strong></div></div><div className="topbar-right"><span className="today-label">{new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())}</span><LanguageSelect /><div className="icon-button" aria-label={t("Teaching workspace")}><BookOpenCheck size={15} /></div></div></header>
      {children}
    </div>
  </div>;
}
