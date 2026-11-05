import { EFFECT_KINDS, type EffectKind } from "@openvtt/shared";
import { useTranslation } from "react-i18next";
import { useTableUi } from "../../tableStore";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Select } from "../ui/select";

/** Effects that carry a number, and what it means for each. */
const VALUE_LABEL: Partial<Record<EffectKind, "effects.amount" | "effects.radius">> = {
  damage: "effects.amount",
  heal: "effects.amount",
  blast: "effects.radius",
};

/** Shown above the map tools while the effect tool is active: what to fire, with which number, and what to click next. */
export function EffectOptions() {
  const { t } = useTranslation();
  const { effectKind, effectValue, effectOrigin, setEffectChoice } = useTableUi();
  const valueLabel = VALUE_LABEL[effectKind];
  return (
    <div
      role="group"
      aria-label={t("effects.options")}
      className="ruler-options flex flex-wrap items-center gap-2 rounded-panel bg-chrome p-2 shadow-float"
    >
      <Select
        aria-label={t("effects.kind")}
        value={effectKind}
        // A blast starts at a modest radius, the other numbers at a typical hit.
        onValueChange={(value) => setEffectChoice({ effectKind: value as EffectKind, effectValue: value === "blast" ? 2 : 5 })}
      >
        {EFFECT_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t(`effects.kinds.${kind}`)}
          </option>
        ))}
      </Select>
      {valueLabel && (
        <Field label={t(valueLabel)} inline>
          {(control) => (
            <Input
              {...control}
              type="number"
              min={0}
              max={9999}
              className="w-20"
              value={effectValue}
              onChange={(e) => setEffectChoice({ effectValue: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
            />
          )}
        </Field>
      )}
      <p className="m-0 px-2 text-on-chrome-2 text-sm">
        {effectKind === "projectile" ? t(effectOrigin ? "effects.hintTarget" : "effects.hintOrigin") : t("effects.hint")}
      </p>
    </div>
  );
}
