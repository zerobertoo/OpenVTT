import { MAP_LAYERS, type MapLayer, type MemberDto, type SceneDto } from "@openvtt/shared";
import { useTranslation } from "react-i18next";
import { Icon } from "../../icons";
import type { MapLayers } from "../../tableStore";
import { Switch } from "../ui/checkbox";
import { Field } from "../ui/field";
import { Select } from "../ui/input";
import { Popover } from "../ui/popover";

interface Props {
  scene: SceneDto | null;
  players: MemberDto[];
  layers: MapLayers;
  onLayerChange: (layer: keyof MapLayers, show: boolean) => void;
  /** Player whose view is being previewed; null is the normal game master view. */
  viewAsUserId: string | null;
  onViewAsChange: (userId: string | null) => void;
  onLockChange: (lockedLayers: MapLayer[]) => void;
}

const LAYER_VISIBILITY = { background: "background", objects: "objects", tokens: "tokens", gm: "gmDrawings" } as const satisfies Record<
  MapLayer,
  keyof MapLayers
>;

const LAYER_LABELS = ["walls", "doors", "lights", "lightRange", "grid"] as const satisfies readonly (keyof MapLayers)[];

/** Game master only: which overlays are drawn on the map, and a preview of what one player sees. */
export function MapLayersMenu({ scene, players, layers, onLayerChange, viewAsUserId, onViewAsChange, onLockChange }: Props) {
  const { t } = useTranslation();
  const previewing = viewAsUserId !== null;
  const hasMapData = Boolean(scene && (scene.walls.length > 0 || scene.lights.length > 0));
  return (
    <Popover
      className="w-80"
      label={t("layers.title")}
      trigger={
        <button
          type="button"
          aria-pressed={previewing}
          className="flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[1.2rem] border-0 bg-chrome px-4 text-[0.78rem] text-on-chrome-2 shadow-float hover:bg-chrome-2 hover:text-on-chrome focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 aria-pressed:bg-accent aria-pressed:text-on-accent"
        >
          <Icon name="layers" />
          {t("layers.title")}
        </button>
      }
    >
      <div className="grid gap-3">
        {players.length > 0 && (
          <Field
            label={t("layers.viewAs")}
            hint={
              previewing && scene && !scene.visionEnabled ? t("layers.viewAsNoVision") : previewing ? t("layers.viewAsHint") : undefined
            }
          >
            {(control) => (
              <Select {...control} value={viewAsUserId ?? ""} onChange={(e) => onViewAsChange(e.target.value || null)}>
                <option value="">{t("layers.viewAsNobody")}</option>
                {players.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.displayName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {scene && (
          <fieldset className="m-0 grid min-w-0 grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2 border-0 p-0">
            <legend className="mb-1 p-0 font-semibold text-[0.9rem]">{t("layers.mapLayers")}</legend>
            <span aria-hidden="true" />
            <span aria-hidden="true" className="text-ink-2 text-xs">
              {t("layers.show")}
            </span>
            <span aria-hidden="true" className="text-ink-2 text-xs">
              {t("layers.lock")}
            </span>
            {MAP_LAYERS.map((layer) => {
              const name = t(`layers.names.${layer}`);
              const locked = scene.lockedLayers.includes(layer);
              return (
                <div key={layer} className="contents">
                  <span>{name}</span>
                  <Switch
                    aria-label={t("layers.showLayer", { name })}
                    checked={previewing ? layer !== "gm" : layers[LAYER_VISIBILITY[layer]]}
                    disabled={previewing}
                    onChange={(e) => onLayerChange(LAYER_VISIBILITY[layer], e.target.checked)}
                  />
                  <Switch
                    aria-label={t("layers.lockLayer", { name })}
                    checked={locked}
                    onChange={(e) =>
                      onLockChange(e.target.checked ? [...scene.lockedLayers, layer] : scene.lockedLayers.filter((l) => l !== layer))
                    }
                  />
                </div>
              );
            })}
          </fieldset>
        )}
        <fieldset disabled={previewing} className="m-0 grid min-w-0 gap-2 border-0 p-0">
          <legend className="mb-1 p-0 font-semibold text-[0.9rem]">{t("layers.overlays")}</legend>
          {LAYER_LABELS.map((layer) => {
            // Overlays that need map data are pointless on a scene without any.
            const needsData = layer !== "grid" && !hasMapData;
            return (
              <Field key={layer} label={t(`layers.${layer}`)} inline>
                {(control) => (
                  <Switch
                    {...control}
                    checked={!previewing && layers[layer]}
                    disabled={needsData}
                    onChange={(e) => onLayerChange(layer, e.target.checked)}
                  />
                )}
              </Field>
            );
          })}
        </fieldset>
        {previewing && <p className="m-0 text-ink-2 text-sm">{t("layers.previewOverrides")}</p>}
        {scene?.bakedLighting && <p className="m-0 text-ink-2 text-sm">{t("layers.baked")}</p>}
      </div>
    </Popover>
  );
}
