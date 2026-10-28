import { useTranslation } from "react-i18next";
import { usePreferences } from "../../lib/preferences";
import { Switch } from "../ui/checkbox";
import { Field } from "../ui/field";

/** Turns the dice animation over the table on or off for this browser. */
export function DiceSetting() {
  const { t } = useTranslation();
  const on = usePreferences((state) => state.diceOverlay);
  const setOn = usePreferences((state) => state.setDiceOverlay);
  return (
    <Field label={t("measure.diceOverlay")} hint={t("measure.diceOverlayHint")} inline>
      {(control) => <Switch {...control} checked={on} onChange={(e) => setOn(e.target.checked)} />}
    </Field>
  );
}
