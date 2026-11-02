import { type Locale, SUPPORTED_LOCALES } from "@openvtt/shared";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ptBr from "./pt-br.json";

const STORAGE_KEY = "openvtt.locale";

export function normalizeLocale(raw: string | null | undefined): Locale | null {
  const lower = raw?.toLowerCase();
  if (!lower) return null;
  return SUPPORTED_LOCALES.find((l) => l === lower) ?? SUPPORTED_LOCALES.find((l) => lower.split("-")[0] === l.split("-")[0]) ?? null;
}

/** Saved choice first, then the browser language, then English. */
export function detectInitialLocale(): Locale {
  // Blocked storage (strict privacy modes) throws; the browser language still works then.
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {}
  const saved = normalizeLocale(stored);
  if (saved) return saved;
  for (const lang of navigator.languages) {
    const match = normalizeLocale(lang);
    if (match) return match;
  }
  return "en";
}

export function setLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {}
  void i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, "pt-br": { translation: ptBr } },
  lng: detectInitialLocale(),
  fallbackLng: "en",
  // Without this i18next rewrites "pt-br" as "pt-BR", which would miss our resource key.
  lowerCaseLng: true,
  interpolation: { escapeValue: false },
});
document.documentElement.lang = i18n.language;

export { i18n };
