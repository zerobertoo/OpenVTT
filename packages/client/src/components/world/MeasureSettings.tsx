import { useTranslation } from "react-i18next";
import { usePreferences } from "../../lib/preferences";
import type { MeasureSystem } from "../../lib/units";
import { Field } from "../ui/field";
import { Input, Select } from "../ui/input";

/** How this browser shows distances: as the scene was authored, imperial or metric. */
export function MeasureSettings() {
  const { t } = useTranslation();
  const measure = usePreferences((state) => state.measure);
  const setMeasure = usePreferences((state) => state.setMeasure);
  return (
    <div className="grid gap-2">
      <Field label={t("measure.system")} hint={t("measure.systemHint")}>
        {(control) => (
          <Select {...control} value={measure.system} onChange={(e) => setMeasure({ system: e.target.value as MeasureSystem })}>
            <option value="scene">{t("measure.scene")}</option>
            <option value="imperial">{t("measure.imperial")}</option>
            <option value="metric">{t("measure.metric")}</option>
          </Select>
        )}
      </Field>
      {measure.system !== "scene" && (
        <Field label={t("measure.metersPerFoot")} hint={t("measure.metersPerFootHint")}>
          {(control) => (
            <Input
              {...control}
              type="number"
              min={0.1}
              max={1}
              step={0.0001}
              value={measure.metersPerFoot}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value >= 0.1 && value <= 1) setMeasure({ metersPerFoot: value });
              }}
            />
          )}
        </Field>
      )}
    </div>
  );
}
