import { useTranslation } from "react-i18next";
import { usePreferences } from "../../lib/preferences";
import { Switch } from "../ui/checkbox";
import { Field } from "../ui/field";
import { Slider } from "../ui/slider";

export function SoundSetting() {
  const { t } = useTranslation();
  const { sounds, setSounds, musicVolume, setMusicVolume } = usePreferences();
  return (
    <>
      <Field label={t("alerts.sounds")} hint={t("alerts.soundsHint")} inline>
        {(control) => <Switch {...control} checked={sounds} onChange={(e) => setSounds(e.target.checked)} />}
      </Field>
      <Field label={t("alerts.musicVolume")}>
        {(control) => (
          <Slider
            {...control}
            aria-label={t("alerts.musicVolume")}
            min={0}
            max={1}
            step={0.05}
            value={musicVolume}
            onValueChange={setMusicVolume}
          />
        )}
      </Field>
    </>
  );
}
