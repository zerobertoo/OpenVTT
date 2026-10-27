import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { SUPPORTED_LOCALES, type Locale } from "@openvtt/shared";
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
  const saved = normalizeLocale(localStorage.getItem(STORAGE_KEY));
  if (saved) return saved;
  for (const lang of navigator.languages) {
    const match = normalizeLocale(lang);
    if (match) return match;
  }
  return "en";
}

export function setLocale(locale: Locale) {
  localStorage.setItem(STORAGE_KEY, locale);
  void i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, "pt-br": { translation: ptBr } },
  lng: detectInitialLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});
document.documentElement.lang = i18n.language;

export { i18n };
