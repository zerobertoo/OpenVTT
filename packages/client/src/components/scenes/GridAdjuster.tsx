import type { FloorDto, SceneDto } from "@openvtt/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { assetUrl } from "../../api";
import { ErrorMessage } from "../../ui";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Slider } from "../ui/slider";

const MIN_CELL = 10;
const MAX_CELL = 500;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scene: Pick<SceneDto, "width" | "height" | "gridSize">;
  /** The picture or video the grid is lined up with. */
  background: Pick<FloorDto, "assetId" | "assetKind">;
  onApply: (gridSize: number) => void;
  /** Failure of the last apply, shown inside the dialog because the page behind it is covered. */
  error?: unknown;
  pending?: boolean;
}

/**
 * Lines a square grid up with the map by eye: the grid is drawn over the picture while the cell size changes, and
 * a zoom lets the far corner be checked, where a small error in the cell size adds up.
 */
export function GridAdjuster({ open, onOpenChange, scene, background, onApply, pending, error }: Props) {
  const { t } = useTranslation();
  const [size, setSize] = useState(scene.gridSize);
  // The number box keeps what is being typed (so "7" on the way to "70" is not forced to 10); only valid sizes move the grid.
  const [typed, setTyped] = useState(String(scene.gridSize));
  const [zoom, setZoom] = useState(1);
  const clamp = (value: number) => Math.min(MAX_CELL, Math.max(MIN_CELL, Math.round(value) || MIN_CELL));
  const columns = scene.width / size;
  const rows = scene.height / size;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("scene.gridAdjust.adjustTitle")}
      description={t("scene.gridAdjust.adjustHint")}
    >
      {/* A scrollable window on the map; the grid overlay is a repeating gradient sized in map percentages. */}
      <div className="max-h-[50dvh] overflow-auto rounded-lg border-[1.5px] border-line">
        <div className="relative" style={{ width: `${zoom * 100}%` }}>
          {background.assetId && background.assetKind === "video" ? (
            // biome-ignore lint/a11y/useMediaCaption: a silent map background has nothing to caption
            <video src={assetUrl(background.assetId)} muted preload="metadata" className="block w-full" />
          ) : background.assetId ? (
            <img src={assetUrl(background.assetId)} alt="" className="block w-full" />
          ) : (
            <div className="w-full bg-surface-2" style={{ aspectRatio: `${scene.width} / ${scene.height}` }} />
          )}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, #ffc914 1.5px, transparent 1.5px), linear-gradient(to bottom, #ffc914 1.5px, transparent 1.5px)",
              backgroundSize: `${(100 / columns).toFixed(4)}% ${(100 / rows).toFixed(4)}%`,
            }}
          />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <Field label={t("scene.gridSize")}>
          {(control) => (
            <Slider
              {...control}
              aria-label={t("scene.gridSize")}
              min={MIN_CELL}
              max={MAX_CELL}
              value={size}
              onValueChange={(next) => {
                setSize(clamp(next));
                setTyped(String(clamp(next)));
              }}
            />
          )}
        </Field>
        <Field label={t("scene.gridAdjust.exact")}>
          {(control) => (
            <Input
              {...control}
              type="number"
              min={MIN_CELL}
              max={MAX_CELL}
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                const value = Number(e.target.value);
                if (Number.isInteger(value) && value >= MIN_CELL && value <= MAX_CELL) setSize(value);
              }}
              onBlur={() => setTyped(String(size))}
              className="w-24"
            />
          )}
        </Field>
      </div>
      <Field label={t("scene.gridAdjust.zoom")}>
        {(control) => (
          <Select {...control} value={zoom} onValueChange={(value) => setZoom(Number(value))}>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={3}>3×</option>
          </Select>
        )}
      </Field>
      <ErrorMessage error={error} />
      <Button pending={pending} className="justify-self-start" onClick={() => onApply(size)}>
        {t("scene.gridAdjust.apply")}
      </Button>
    </Dialog>
  );
}
