import { useTranslation } from "react-i18next";
import { usePreferences } from "../../lib/preferences";
import { Switch } from "../ui/checkbox";
import { Field } from "../ui/field";

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
          <input
            {...control}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={musicVolume}
            onChange={(e) => setMusicVolume(Number(e.target.value))}
            className="w-full accent-accent"
          />
        )}
      </Field>
    </>
  );
}
