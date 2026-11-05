import type { AmbientDto, AssetSummaryDto } from "@openvtt/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import { ErrorMessage, useAction } from "../../ui";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { FileButton } from "../ui/file-button";
import { Select } from "../ui/select";
import { Slider } from "../ui/slider";

export function MusicControls({ worldId, ambient }: { worldId: string; ambient: AmbientDto | null }) {
  const { t } = useTranslation();
  const { run, error, pending } = useAction();
  const [tracks, setTracks] = useState<AssetSummaryDto[]>([]);
  const [choice, setChoice] = useState(ambient?.assetId ?? "");
  // Follows the server's value, but moves freely while the slider is dragged.
  const [master, setMaster] = useState(ambient?.volume ?? 1);
  useEffect(() => setMaster(ambient?.volume ?? 1), [ambient?.volume]);
  const load = () => run(async () => setTracks((await api.worldAssets(worldId)).filter((a) => a.mime.startsWith("audio/"))));
  // biome-ignore lint/correctness/useExhaustiveDependencies: loads once per world
  useEffect(() => void load(), [worldId]);
  const set = (assetId: string | null, playing: boolean) => run(() => api.setAmbient(worldId, { assetId, playing }));

  return (
    <section aria-label={t("alerts.music")} className="grid gap-2">
      <h3>{t("alerts.music")}</h3>
      {tracks.length > 0 && (
        <Field label={t("alerts.track")}>
          {(control) => (
            <Select {...control} value={choice} onValueChange={(value) => setChoice(value)}>
              <option value="">{t("alerts.noTrack")}</option>
              {tracks.map((track, i) => (
                <option key={track.id} value={track.id}>
                  {t("alerts.trackName", { n: tracks.length - i, size: (track.size / 1048576).toFixed(1) })}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <Field label={t("alerts.masterVolume")}>
        {(control) => (
          <Slider
            {...control}
            aria-label={t("alerts.masterVolume")}
            min={0}
            max={1}
            step={0.05}
            value={master}
            disabled={!ambient}
            onValueChange={setMaster}
            onValueCommit={(volume) => void run(() => api.setAmbientVolume(worldId, volume))}
          />
        )}
      </Field>
      <div className="flex flex-wrap gap-2">
        {ambient?.playing ? (
          <Button size="sm" pending={pending} onClick={() => set(ambient.assetId, false)}>
            {t("alerts.stop")}
          </Button>
        ) : (
          <Button size="sm" pending={pending} disabled={!choice} onClick={() => set(choice, true)}>
            {t("alerts.play")}
          </Button>
        )}
        <FileButton
          label={t("alerts.upload")}
          accept="audio/mpeg,audio/ogg"
          size="sm"
          pending={pending}
          onPick={(file) =>
            void run(async () => {
              // Browsers disagree on these types (video/ogg, audio/mp3); the server checks the bytes anyway.
              const type = file.name.toLowerCase().endsWith(".ogg") ? "audio/ogg" : "audio/mpeg";
              const { id } = await api.uploadAsset(worldId, new Blob([file], { type }));
              setChoice(id);
              await load();
            })
          }
        />
      </div>
      <ErrorMessage error={error} />
    </section>
  );
}
