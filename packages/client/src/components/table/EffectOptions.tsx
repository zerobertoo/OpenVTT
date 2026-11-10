import { AREA_EFFECTS, EFFECT_KINDS, type EffectKind, NUMBERED_EFFECTS, TRAVELLING_EFFECTS } from "@openvtt/shared";
import { useTranslation } from "react-i18next";
import { AMOUNT_EFFECTS, STRIKE_EFFECTS } from "../../lib/effectActions";
import { useTableUi } from "../../tableStore";
import { Switch } from "../ui/checkbox";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Select } from "../ui/select";

/** What the number of an effect means: a radius for areas, the size of a hit for the rest. */
const valueLabel = (kind: EffectKind) =>
  NUMBERED_EFFECTS.includes(kind) ? (AREA_EFFECTS.includes(kind) ? "effects.radius" : "effects.amount") : null;

/** Shown above the map tools while the effect tool is active: what to fire, with which number, and what to click next. */
export function EffectOptions() {
  const { t } = useTranslation();
  const { effectKind, effectValue, effectDamage, effectAffects, effectOrigin, setEffectChoice } = useTableUi();
  const label = valueLabel(effectKind);
  // Strikes and areas take a damage number of their own; damage and healing already have their amount.
  const hurts =
    effectAffects && !AMOUNT_EFFECTS.includes(effectKind) && (STRIKE_EFFECTS.includes(effectKind) || AREA_EFFECTS.includes(effectKind));
  return (
    <div
      role="group"
      aria-label={t("effects.options")}
      className="ruler-options flex flex-wrap items-center gap-2 rounded-panel bg-chrome p-2 shadow-float"
    >
      <Select
        aria-label={t("effects.kind")}
        value={effectKind}
        // An area starts at a modest radius, the other numbers at a typical hit.
        onValueChange={(value) =>
          setEffectChoice({ effectKind: value as EffectKind, effectValue: AREA_EFFECTS.includes(value as EffectKind) ? 2 : 5 })
        }
      >
        {EFFECT_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t(`effects.kinds.${kind}`)}
          </option>
        ))}
      </Select>
      {label && (
        <Field label={t(label)} inline>
          {(control) => (
            <Input
              {...control}
              type="number"
              min={0}
              max={9999}
              className="w-20"
              // Uncontrolled, so clearing the field to type a new number does not snap back to 0.
              key={effectKind}
              defaultValue={effectValue}
              onChange={(e) => setEffectChoice({ effectValue: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
            />
          )}
        </Field>
      )}
      {hurts && (
        <Field label={t("effects.damage")} inline>
          {(control) => (
            <Input
              {...control}
              type="number"
              min={0}
              max={9999}
              className="w-20"
              defaultValue={effectDamage}
              onChange={(e) => setEffectChoice({ effectDamage: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
            />
          )}
        </Field>
      )}
      <Field label={t("effects.affect")} inline>
        {(control) => (
          <Switch {...control} checked={effectAffects} onChange={(e) => setEffectChoice({ effectAffects: e.target.checked })} />
        )}
      </Field>
      <p className="m-0 px-2 text-on-chrome-2 text-sm">
        {TRAVELLING_EFFECTS.includes(effectKind) ? t(effectOrigin ? "effects.hintTarget" : "effects.hintOrigin") : t("effects.hint")}
      </p>
    </div>
  );
}
