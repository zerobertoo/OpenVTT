import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createFormatter } from "./lib/format";
import { usePreferences } from "./lib/preferences";

/** Date, time, number and distance formatting in the current interface language and measurement preference. */
export function useFormat() {
  const { i18n } = useTranslation();
  const measure = usePreferences((state) => state.measure);
  return useMemo(() => {
    const base = createFormatter(i18n.language);
    return { ...base, distance: (cells: number, scene: Parameters<typeof base.distance>[1]) => base.distance(cells, scene, measure) };
  }, [i18n.language, measure]);
}
