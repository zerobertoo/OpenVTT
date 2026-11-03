import { floorOf, type SceneDto, type WorldStateDto } from "@openvtt/shared";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api } from "../api";
import { FloorManager } from "../components/scenes/FloorManager";
import { GridAdjuster } from "../components/scenes/GridAdjuster";
import { type MapImportChoice, MapImportDialog } from "../components/scenes/MapImportDialog";
import { SceneCard } from "../components/scenes/SceneCard";
import { SceneCreateForm, SceneSettingsForm } from "../components/scenes/SceneForms";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { groupFloors } from "../lib/mapImport";
import { readMediaSize, UnsupportedMediaError } from "../lib/media";
import { ErrorMessage, useAction } from "../ui";

interface Props {
  state: WorldStateDto;
  viewSceneId: string | null;
  onView: (sceneId: string) => void;
  /** Applies new settings to a scene so the game master can undo them. */
  onChangeScene: (scene: SceneDto, changes: Record<string, unknown>) => Promise<void>;
  onRenameFloor: (floor: { id: string; name: string }, name: string) => void;
  onAddFloor: (sceneId: string, floor: { name: string; assetId: string | null }) => void;
}

export function ScenePanel({ state, viewSceneId, onView, onChangeScene, onRenameFloor, onAddFloor }: Props) {
  const { t } = useTranslation();
  const { run, error, pending } = useAction();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [adjustingGrid, setAdjustingGrid] = useState(false);
  const current = state.scenes.find((s) => s.id === viewSceneId) ?? null;
  const walls = current?.floors.reduce((sum, f) => sum + f.walls.length, 0) ?? 0;
  const lights = current?.floors.reduce((sum, f) => sum + f.lights.length, 0) ?? 0;

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
      let first: string | null = null;
      // Files that are floors of one map (`Tavern_0`, `Tavern_1`) become one scene with a floor each, as long as they
      // line up (same size and grid); anything else stays one scene per file.
      for (const group of groupFloors(choice)) {
        const floors = [];
        for (const [index, draft] of group.entries()) {
          const assetId = (await api.uploadAsset(state.id, draft.media)).id;
          floors.push({
            // numbered by place in the stack, so files starting at _1 still give "Floor 1", "Floor 2"
            name: group.length > 1 ? t("scene.floorName", { n: index + 1 }) : draft.name,
            assetId,
            walls: [
              ...(draft.data?.walls ?? []).map((w) => ({ ...w, kind: "wall" })),
              ...(draft.data?.doors ?? []).map(({ closed, ...w }) => ({ ...w, kind: "door", open: !closed })),
            ],
            lights: draft.data?.lights ?? [],
          });
        }
        const lead = group[0]!;
        const scene = await api.createScene(state.id, {
          name: group.length > 1 ? lead.name.replace(/[\s_-]*\d{1,2}$/, "") || lead.name : lead.name,
          width: lead.width,
          height: lead.height,
          gridType: "square",
          gridSize: lead.gridSize,
          gridDistance: lead.gridDistance,
          distanceUnit: lead.distanceUnit,
          bakedLighting: lead.data?.bakedLighting ?? false,
          floors,
        });
        first ??= scene.id;
      }
      setImporting(false);
      if (first) onView(first);
    });

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!current) return;
    const f = new FormData(e.currentTarget);
    void run(() =>
      onChangeScene(current, {
        name: String(f.get("name")),
        gridType: String(f.get("gridType")),
        gridSize: Number(f.get("gridSize")),
        gridDistance: Number(f.get("gridDistance")),
        distanceUnit: String(f.get("distanceUnit")),
        ...(f.has("ambientLight") && { ambientLight: Number(f.get("ambientLight")) }),
        visionEnabled: f.get("visionEnabled") === "on",
        visionRadius: Number(f.get("visionRadius")),
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

      {current && (walls > 0 || lights > 0) && <p className="m-0 text-ink-2 text-sm">{t("scene.mapDataSummary", { walls, lights })}</p>}

      {current && (
        // The key makes the uncontrolled inputs reset when another scene (or a server update) is shown.
        <SceneSettingsForm
          key={JSON.stringify(current)}
          scene={current}
          onSubmit={save}
          pending={pending}
          onAdjustGrid={() => setAdjustingGrid(true)}
        />
      )}

      {current && (
        <FloorManager
          floors={current.floors}
          tableFloorId={current.tableFloorId}
          pending={pending}
          onRename={(floorId, name) => {
            const floor = current.floors.find((f) => f.id === floorId);
            if (floor) onRenameFloor(floor, name);
          }}
          onMove={(floorId, position) => void run(() => api.updateFloor(floorId, { position }))}
          onShowToTable={(floorId) => onChangeScene(current, { tableFloorId: floorId })}
          onDelete={(floorId) => void run(() => api.deleteFloor(floorId))}
          onAdd={(name, background) =>
            void run(async () => {
              const assetId = background ? (await api.uploadAsset(state.id, background)).id : null;
              onAddFloor(current.id, { name, assetId });
            })
          }
        />
      )}

      <h3>{t("scene.new")}</h3>
      <SceneCreateForm onSubmit={create} pending={pending} imageFile={imageFile} onImageChange={setImageFile} />
      <Button variant="secondary" onClick={() => setImporting(true)} className="justify-self-start">
        {t("scene.import.open")}
      </Button>
      {current && (
        <GridAdjuster
          key={`${current.id}-${current.gridSize}`}
          open={adjustingGrid}
          onOpenChange={setAdjustingGrid}
          scene={current}
          background={floorOf(current, current.tableFloorId)}
          pending={pending}
          error={error}
          onApply={(gridSize) =>
            void run(async () => {
              await onChangeScene(current, { gridSize });
              setAdjustingGrid(false);
            })
          }
        />
      )}
      <MapImportDialog open={importing} onOpenChange={setImporting} onCreate={importMap} pending={pending} error={error} />
      <datalist id="distance-units">
        <option value="ft" />
        <option value="m" />
        <option value="sq" />
      </datalist>
      <ErrorMessage error={error} />
    </section>
  );
}
