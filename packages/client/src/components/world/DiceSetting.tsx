import { useTranslation } from "react-i18next";
import { usePreferences } from "../../lib/preferences";
import { Switch } from "../ui/checkbox";
import { Field } from "../ui/field";

/** Turns the dice animation over the table, and its 3D look, on or off for this browser. */
export function DiceSetting() {
  const { t } = useTranslation();
  const overlay = usePreferences((state) => state.diceOverlay);
  const setOverlay = usePreferences((state) => state.setDiceOverlay);
  const solid = usePreferences((state) => state.dice3d);
  const setSolid = usePreferences((state) => state.setDice3d);
  return (
    <>
      <Field label={t("measure.diceOverlay")} hint={t("measure.diceOverlayHint")} inline>
        {(control) => <Switch {...control} checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />}
      </Field>
      <Field label={t("measure.dice3d")} hint={t("measure.dice3dHint")} inline>
        {(control) => <Switch {...control} checked={solid} disabled={!overlay} onChange={(e) => setSolid(e.target.checked)} />}
      </Field>
    </>
  );
}
