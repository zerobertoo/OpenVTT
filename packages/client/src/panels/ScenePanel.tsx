import { MAX_MAP_DIMENSION, type SceneDto, type WorldStateDto } from "@openvtt/shared";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, readImageSize } from "../api";
import { Button } from "../components/ui/button";
import { ErrorMessage, useAction } from "../ui";

interface Props {
  state: WorldStateDto;
  viewSceneId: string | null;
  onView: (sceneId: string) => void;
}

function SceneSettings({ scene }: { scene: SceneDto }) {
  const { t } = useTranslation();
  const { run, error } = useAction();

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(() =>
      api.updateScene(scene.id, {
        name: String(f.get("name")),
        gridType: String(f.get("gridType")),
        gridSize: Number(f.get("gridSize")),
        gridDistance: Number(f.get("gridDistance")),
        distanceUnit: String(f.get("distanceUnit")),
      }),
    );
  };

  return (
    // The key makes the uncontrolled inputs reset when another scene (or a server update) is shown.
    <form onSubmit={submit} key={JSON.stringify(scene)} className="compact">
      <label>
        {t("scene.name")}
        <input name="name" defaultValue={scene.name} required maxLength={80} />
      </label>
      <label>
        {t("scene.grid")}
        <select name="gridType" defaultValue={scene.gridType}>
          <option value="square">{t("scene.gridSquare")}</option>
          <option value="none">{t("scene.gridNone")}</option>
        </select>
      </label>
      <label>
        {t("scene.gridSize")}
        <input name="gridSize" type="number" min={10} max={500} defaultValue={scene.gridSize} />
      </label>
      <label>
        {t("scene.gridDistance")}
        <input name="gridDistance" type="number" min={0.1} step="any" defaultValue={scene.gridDistance} />
      </label>
      <label>
        {t("scene.distanceUnit")}
        <input name="distanceUnit" defaultValue={scene.distanceUnit} maxLength={10} />
      </label>
      <Button type="submit">{t("common.save")}</Button>
      <ErrorMessage error={error} />
    </form>
  );
}

export function ScenePanel({ state, viewSceneId, onView }: Props) {
  const { t } = useTranslation();
  const { run, error, pending } = useAction();
  const current = state.scenes.find((s) => s.id === viewSceneId) ?? null;

  const create = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const file = f.get("image") as File;
    void run(async () => {
      let size = { width: Number(f.get("width")), height: Number(f.get("height")) };
      let assetId: string | null = null;
      if (file.size > 0) {
        size = await readImageSize(file);
        assetId = (await api.uploadAsset(state.id, file)).id;
      }
      const scene = await api.createScene(state.id, {
        name: String(f.get("name")),
        assetId,
        ...size,
        gridType: String(f.get("gridType")),
      });
      form.reset();
      onView(scene.id);
    });
  };

  return (
    <section aria-label={t("scene.title")}>
      <h3>{t("scene.title")}</h3>
      <ul className="plain">
        {state.scenes.map((s) => (
          <li key={s.id}>
            <Button variant="secondary" aria-pressed={s.id === viewSceneId} onClick={() => onView(s.id)}>
              {s.name}
            </Button>
            {s.id === state.activeSceneId ? (
              <span className="muted">{t("scene.active")}</span>
            ) : (
              <Button variant="link" onClick={() => run(() => api.updateWorld(state.id, { activeSceneId: s.id }))}>
                {t("scene.activate")}
              </Button>
            )}
            <Button variant="dangerLink" onClick={() => run(() => api.deleteScene(s.id))}>
              {t("common.delete")}
            </Button>
          </li>
        ))}
      </ul>
      {current && <SceneSettings scene={current} />}

      <h3>{t("scene.new")}</h3>
      <form onSubmit={create} className="compact">
        <label>
          {t("scene.name")}
          <input name="name" required maxLength={80} />
        </label>
        <label>
          {t("scene.image")}
          <input name="image" type="file" accept="image/png,image/jpeg,image/webp" />
        </label>
        <label>
          {t("scene.width")}
          <input name="width" type="number" min={1} max={MAX_MAP_DIMENSION} defaultValue={2000} />
        </label>
        <label>
          {t("scene.height")}
          <input name="height" type="number" min={1} max={MAX_MAP_DIMENSION} defaultValue={1500} />
        </label>
        <label>
          {t("scene.grid")}
          <select name="gridType" defaultValue="square">
            <option value="square">{t("scene.gridSquare")}</option>
            <option value="none">{t("scene.gridNone")}</option>
          </select>
        </label>
        <Button type="submit" disabled={pending}>
          {t("scene.create")}
        </Button>
      </form>
      <ErrorMessage error={error} />
    </section>
  );
}
