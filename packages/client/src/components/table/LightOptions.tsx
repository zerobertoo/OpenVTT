import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LightInput } from "../../lib/tableActions";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { ColorPicker } from "../ui/color-picker";
import { Slider } from "../ui/slider";

interface Props {
  /** The light being edited; null shows only the hint on how to place one. */
  light: LightInput | null;
  /** Saves the new values (one undo step). */
  onChange: (changes: Partial<LightInput>) => void;
  onDelete: () => void;
}

/** A slider that follows the pointer locally and saves once when it is released, so a drag is one undo step. */
function LightSlider({
  label,
  value,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
}) {
  const [shown, setShown] = useState(value);
  useEffect(() => setShown(value), [value]);
  const id = useId();
  return (
    <div className="grid w-40 gap-0.5">
      <label htmlFor={id} className="text-on-chrome-2 text-sm">
        {label}: {Math.round(shown * 100) / 100}
      </label>
      <Slider id={id} aria-label={label} value={shown} min={min} max={max} step={step} onValueChange={setShown} onValueCommit={onCommit} />
    </div>
  );
}

/** Settings of the light picked with the light tool, in the same bar style as the ruler and drawing options. */
export function LightOptions({ light, onChange, onDelete }: Props) {
  const { t } = useTranslation();
  const shadowsId = useId();
  return (
    <div
      role="group"
      aria-label={t("light.options")}
      className="ruler-options flex flex-wrap items-center gap-2 rounded-[1.2rem] bg-chrome p-2 shadow-float"
    >
      {light ? (
        <>
          <LightSlider
            label={t("light.radius")}
            value={light.radius}
            min={0.5}
            max={30}
            step={0.5}
            onCommit={(radius) => onChange({ radius })}
          />
          <LightSlider
            label={t("light.feather")}
            value={light.feather}
            min={0}
            max={1}
            step={0.05}
            onCommit={(feather) => onChange({ feather })}
          />
          <LightSlider
            label={t("light.intensity")}
            value={light.intensity}
            min={0}
            max={1}
            step={0.1}
            onCommit={(intensity) => onChange({ intensity })}
          />
          <ColorPicker aria-label={t("light.color")} value={light.color} onChange={(color) => onChange({ color })} className="w-32" />
          <div className="flex items-center gap-2">
            <Checkbox id={shadowsId} checked={light.shadows} onChange={(e) => onChange({ shadows: e.target.checked })} />
            <label htmlFor={shadowsId} className="text-on-chrome-2 text-sm">
              {t("light.shadows")}
            </label>
          </div>
          <Button variant="secondary" size="sm" onClick={onDelete}>
            {t("light.delete")}
          </Button>
        </>
      ) : (
        <p className="m-0 px-2 text-on-chrome-2 text-sm">{t("light.hint")}</p>
      )}
    </div>
  );
}
