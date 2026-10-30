import type { SceneDto } from "@openvtt/shared";
import { useTranslation } from "react-i18next";
import { usePreferences } from "../../lib/preferences";
import { DIAGONAL_RULES, RULER_SHAPES } from "../../lib/ruler";
import type { MeasureSystem } from "../../lib/units";
import { Select } from "../ui/input";

const SYSTEMS: readonly MeasureSystem[] = ["metric", "imperial", "scene"];

/** Shown above the map tools while the ruler is active: what to draw, how to count diagonals and in which units. */
export function RulerOptions({ scene }: { scene: SceneDto | null }) {
  const { t } = useTranslation();
  const { rulerShape, setRulerShape, diagonalRule, setDiagonalRule, measure, setMeasure } = usePreferences();
  return (
    <div
      role="group"
      aria-label={t("ruler.options")}
      className="ruler-options flex flex-wrap items-center gap-2 rounded-[1.2rem] bg-chrome p-2 shadow-float"
    >
      <Select
        aria-label={t("ruler.shape")}
        value={rulerShape}
        onChange={(e) => setRulerShape(e.target.value as (typeof RULER_SHAPES)[number])}
      >
        {RULER_SHAPES.map((shape) => (
          <option key={shape} value={shape}>
            {t(`ruler.shapes.${shape}`)}
          </option>
        ))}
      </Select>
      {rulerShape === "line" && scene?.gridType === "square" && (
        <Select
          aria-label={t("ruler.diagonal")}
          value={diagonalRule}
          onChange={(e) => setDiagonalRule(e.target.value as (typeof DIAGONAL_RULES)[number])}
        >
          {DIAGONAL_RULES.map((rule) => (
            <option key={rule} value={rule}>
              {t(`ruler.diagonals.${rule}`)}
            </option>
          ))}
        </Select>
      )}
      <Select
        aria-label={t("measure.system")}
        value={measure.system}
        onChange={(e) => setMeasure({ system: e.target.value as MeasureSystem })}
      >
        {SYSTEMS.map((system) => (
          <option key={system} value={system}>
            {t(`measure.${system}`)}
          </option>
        ))}
      </Select>
    </div>
  );
}
