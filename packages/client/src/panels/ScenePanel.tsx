import type { WorldStateDto } from "@openvtt/shared";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api } from "../api";
import { type MapImportChoice, MapImportDialog } from "../components/scenes/MapImportDialog";
import { SceneCard } from "../components/scenes/SceneCard";
import { SceneCreateForm, SceneSettingsForm } from "../components/scenes/SceneForms";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { readMediaSize, UnsupportedMediaError } from "../lib/media";
import { ErrorMessage, useAction } from "../ui";

interface Props {
  state: WorldStateDto;
  viewSceneId: string | null;
  onView: (sceneId: string) => void;
}

export function ScenePanel({ state, viewSceneId, onView }: Props) {
  const { t } = useTranslation();
  const { run, error, pending } = useAction();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const current = state.scenes.find((s) => s.id === viewSceneId) ?? null;

  const create = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    void run(async () => {
      let size = { width: Number(f.get("width")), height: Number(f.get("height")) };
      let assetId: string | null = null;
      if (imageFile) {
        size = await readMediaSize(imageFile).catch((error) => {
          throw error instanceof UnsupportedMediaError ? new ApiError("video_unsupported") : error;
        });
        assetId = (await api.uploadAsset(state.id, imageFile)).id;
      }
      const scene = await api.createScene(state.id, {
        name: String(f.get("name")),
        assetId,
        ...size,
        gridType: String(f.get("gridType")),
      });
      form.reset();
      setImageFile(null);
      onView(scene.id);
    });
  };

  const importMap = (choice: MapImportChoice) =>
    void run(async () => {
      const assetId = (await api.uploadAsset(state.id, choice.media)).id;
      const scene = await api.createScene(state.id, {
        name: choice.name,
        assetId,
        width: choice.width,
        height: choice.height,
        gridType: "square",
        gridSize: choice.gridSize,
        gridDistance: choice.gridDistance,
        distanceUnit: choice.distanceUnit,
      });
      setImporting(false);
      onView(scene.id);
    });

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!current) return;
    const f = new FormData(e.currentTarget);
    void run(() =>
      api.updateScene(current.id, {
        name: String(f.get("name")),
        gridType: String(f.get("gridType")),
        gridSize: Number(f.get("gridSize")),
        gridDistance: Number(f.get("gridDistance")),
        distanceUnit: String(f.get("distanceUnit")),
      }),
    );
  };

  return (
    <section aria-label={t("scene.title")} className="grid grid-cols-[minmax(0,1fr)] content-start gap-3">
      <h3>{t("scene.title")}</h3>
      {state.scenes.length === 0 ? (
        <EmptyState title={t("scene.none")} description={t("scene.noneHint")} headingLevel={4} />
      ) : (
        <ul aria-label={t("scene.list")} className="m-0 grid list-none gap-1.5 p-0">
          {state.scenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              viewing={scene.id === viewSceneId}
              shown={scene.id === state.activeSceneId}
              onView={() => onView(scene.id)}
              onShowToPlayers={() => void run(() => api.updateWorld(state.id, { activeSceneId: scene.id }))}
              onDelete={() => void run(() => api.deleteScene(scene.id))}
            />
          ))}
        </ul>
      )}

      {current && (
        // The key makes the uncontrolled inputs reset when another scene (or a server update) is shown.
        <SceneSettingsForm key={JSON.stringify(current)} scene={current} onSubmit={save} pending={pending} />
      )}

      <h3>{t("scene.new")}</h3>
      <SceneCreateForm onSubmit={create} pending={pending} imageFile={imageFile} onImageChange={setImageFile} />
      <Button variant="secondary" onClick={() => setImporting(true)} className="justify-self-start">
        {t("scene.import.open")}
      </Button>
      <MapImportDialog open={importing} onOpenChange={setImporting} onCreate={importMap} pending={pending} />
      <ErrorMessage error={error} />
    </section>
  );
}
