/** Per-browser look: contrast, text size and accent color. Applied at startup, before the first paint of any screen. */
export interface Theme {
  contrast: "normal" | "high";
  textSize: 1 | 1.15 | 1.3;
  /** Hue of the accent; each one keeps the default's lightness, so text on it stays readable. */
  accent: keyof typeof ACCENT_HUES;
}

export const ACCENT_HUES = { teal: 177, blue: 250, violet: 300, rose: 10, amber: 70, green: 145 } as const;
export const TEXT_SIZES = [1, 1.15, 1.3] as const;

const KEY = "openvtt-theme";
const DEFAULT_THEME: Theme = { contrast: "normal", textSize: 1, accent: "teal" };

export function loadTheme(): Theme {
  try {
    return { ...DEFAULT_THEME, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.contrast = theme.contrast;
  root.style.fontSize = theme.textSize === 1 ? "" : `${theme.textSize * 100}%`;
  if (theme.accent === "teal") delete root.dataset.accent;
  else {
    root.dataset.accent = theme.accent;
    root.style.setProperty("--accent-hue", String(ACCENT_HUES[theme.accent] ?? ACCENT_HUES.teal));
  }
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, JSON.stringify(theme));
  } catch {
    // Private windows may refuse storage; the theme still applies until the page closes.
  }
  applyTheme(theme);
}
