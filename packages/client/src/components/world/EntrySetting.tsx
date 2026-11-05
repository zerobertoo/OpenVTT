import { useTranslation } from "react-i18next";
import { usePreferences } from "../../lib/preferences";
import { Switch } from "../ui/checkbox";
import { Field } from "../ui/field";

/** Turns the animation played when joining a table on or off for this browser. */
export function EntrySetting() {
  const { t } = useTranslation();
  const enabled = usePreferences((state) => state.entryAnimation);
  const setEnabled = usePreferences((state) => state.setEntryAnimation);
  return (
    <Field label={t("measure.entryAnimation")} hint={t("measure.entryAnimationHint")} inline>
      {(control) => <Switch {...control} checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
    </Field>
  );
}
