import { MAX_MAP_DIMENSION, type SceneDto } from "@openvtt/shared";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Input, Select } from "../ui/input";

function GridTypeSelect({ defaultValue }: { defaultValue: string }) {
  const { t } = useTranslation();
  return (
    <Field label={t("scene.grid")}>
      {(control) => (
        <Select {...control} name="gridType" defaultValue={defaultValue}>
          <option value="square">{t("scene.gridSquare")}</option>
          <option value="none">{t("scene.gridNone")}</option>
        </Select>
      )}
    </Field>
  );
}

interface SettingsProps {
  /** Opens the visual grid adjuster; the button is left out when not given. */
  onAdjustGrid?: () => void;
  scene: SceneDto;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending?: boolean;
}

/** Name and grid of the scene being looked at. The parent remounts it (via `key`) when the scene changes. */
export function SceneSettingsForm({ scene, onSubmit, pending, onAdjustGrid }: SettingsProps) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit} aria-label={t("scene.settings")} className="grid gap-3">
      <Field label={t("scene.name")}>
        {(control) => <Input {...control} name="name" defaultValue={scene.name} required maxLength={80} />}
      </Field>
      <GridTypeSelect defaultValue={scene.gridType} />
      <div className="grid grid-cols-3 items-end gap-2">
        <Field label={t("scene.gridSize")}>
          {(control) => <Input {...control} name="gridSize" type="number" min={10} max={500} defaultValue={scene.gridSize} />}
        </Field>
        <Field label={t("scene.gridDistance")}>
          {(control) => <Input {...control} name="gridDistance" type="number" min={0.1} step="any" defaultValue={scene.gridDistance} />}
        </Field>
        <Field label={t("scene.distanceUnit")}>
          {(control) => <Input {...control} name="distanceUnit" list="distance-units" defaultValue={scene.distanceUnit} maxLength={10} />}
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" pending={pending}>
          {t("common.save")}
        </Button>
        {onAdjustGrid && scene.gridType === "square" && (
          <Button type="button" variant="secondary" onClick={onAdjustGrid}>
            {t("scene.gridAdjust.open")}
          </Button>
        )}
      </div>
    </form>
  );
}

interface CreateProps {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending?: boolean;
  /** Image chosen for the new scene, or null to use the width and height below. */
  imageFile: File | null;
  onImageChange: (file: File | null) => void;
}

/** New scene: a map image sets its size, or width and height do when there is no image. */
export function SceneCreateForm({ onSubmit, pending, imageFile, onImageChange }: CreateProps) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit} aria-label={t("scene.new")} className="grid gap-3">
      <Field label={t("scene.name")}>{(control) => <Input {...control} name="name" required maxLength={80} />}</Field>
      <Field label={t("scene.image")} hint={imageFile ? t("scene.imageSizeFromFile") : undefined}>
        {(control) => (
          <Input
            {...control}
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp,video/webm,video/mp4"
            onChange={(e) => onImageChange(e.target.files?.[0] ?? null)}
          />
        )}
      </Field>
      {!imageFile && (
        <div className="grid grid-cols-2 gap-2">
          <Field label={t("scene.width")}>
            {(control) => <Input {...control} name="width" type="number" min={1} max={MAX_MAP_DIMENSION} defaultValue={2000} />}
          </Field>
          <Field label={t("scene.height")}>
            {(control) => <Input {...control} name="height" type="number" min={1} max={MAX_MAP_DIMENSION} defaultValue={1500} />}
          </Field>
        </div>
      )}
      <GridTypeSelect defaultValue="square" />
      <Button type="submit" pending={pending} className="justify-self-start">
        {t("scene.create")}
      </Button>
    </form>
  );
}
