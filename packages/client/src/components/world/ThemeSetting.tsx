import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ACCENT_HUES, loadTheme, saveTheme, TEXT_SIZES, type Theme } from "../../lib/theme";
import { Field } from "../ui/field";
import { Select } from "../ui/input";

export function ThemeSetting() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(loadTheme);
  const change = (patch: Partial<Theme>) => {
    const next = { ...theme, ...patch };
    setTheme(next);
    saveTheme(next);
  };
  return (
    <>
      <Field label={t("theme.contrast")}>
        {(control) => (
          <Select {...control} value={theme.contrast} onChange={(e) => change({ contrast: e.target.value as Theme["contrast"] })}>
            <option value="normal">{t("theme.contrastNormal")}</option>
            <option value="high">{t("theme.contrastHigh")}</option>
          </Select>
        )}
      </Field>
      <Field label={t("theme.textSize")}>
        {(control) => (
          <Select {...control} value={theme.textSize} onChange={(e) => change({ textSize: Number(e.target.value) as Theme["textSize"] })}>
            {TEXT_SIZES.map((size) => (
              <option key={size} value={size}>
                {`${Math.round(size * 100)}%`}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t("theme.accent")}>
        {(control) => (
          <Select {...control} value={theme.accent} onChange={(e) => change({ accent: e.target.value as Theme["accent"] })}>
            {(Object.keys(ACCENT_HUES) as Theme["accent"][]).map((accent) => (
              <option key={accent} value={accent}>
                {t(`theme.accents.${accent}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </>
  );
}
