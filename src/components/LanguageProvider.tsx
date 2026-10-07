"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { translate } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (text: string, values?: Record<string, string | number>) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  useEffect(() => {
    const stored = window.localStorage.getItem("teach-portal-language");
    const cookie = document.cookie.split("; ").find((part) => part.startsWith("teach-language="))?.split("=")[1];
    const selected = stored === "vi" || cookie === "vi" ? "vi" : "en";
    document.documentElement.lang = selected;
    const frame = window.requestAnimationFrame(() => setLanguageState(selected));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem("teach-portal-language", next);
    document.cookie = `teach-language=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = next;
  }, []);
  const value = useMemo(() => ({ language, setLanguage, t: (text: string, values?: Record<string, string | number>) => translate(language, text, values) }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider.");
  return context;
}

export function LanguageSelect() {
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  return <label className="language-select"><span>{t("Language")}</span><select aria-label={t("Language")} value={language} onChange={(event) => { setLanguage(event.target.value as Language); router.refresh(); }}><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label>;
}
