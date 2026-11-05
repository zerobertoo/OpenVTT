import { MAX_MAP_DIMENSION, type SceneDto } from "@openvtt/shared";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Field } from "../ui/field";
import { FilePicker } from "../ui/file-picker";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Slider } from "../ui/slider";

/** How lit the scene is, 0 to 100 %: a slider that submits with the form through a hidden field. */
function AmbientLightField({ defaultValue }: { defaultValue: number }) {
  const { t } = useTranslation();
  const [percent, setPercent] = useState(Math.round(defaultValue * 100));
  return (
    <Field label={t("scene.ambientLight")} hint={t("scene.ambientLightHint", { percent })}>
      {(control) => (
        <>
          <input type="hidden" name="ambientLight" value={percent / 100} />
          <Slider
            id={control.id}
            aria-describedby={control["aria-describedby"]}
            aria-label={t("scene.ambientLight")}
            value={percent}
            min={0}
            max={100}
            step={5}
            onValueChange={setPercent}
          />
        </>
      )}
    </Field>
  );
}

function GridTypeSelect({ defaultValue }: { defaultValue: string }) {
  const { t } = useTranslation();
  return (
    <Field label={t("scene.grid")}>
      {(control) => (
        <Select {...control} name="gridType" defaultValue={defaultValue}>
          <option value="square">{t("scene.gridSquare")}</option>
          <option value="hexPointy">{t("scene.gridHexPointy")}</option>
          <option value="hexFlat">{t("scene.gridHexFlat")}</option>
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

/**
 * Name and grid of the scene being looked at. The inputs are uncontrolled, so each one remounts (via its own `key`)
 * when the server value behind it changes, and the others keep what is being typed. The parent remounts the whole
 * form when another scene is shown.
 */
export function SceneSettingsForm({ scene, onSubmit, pending, onAdjustGrid }: SettingsProps) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit} aria-label={t("scene.settings")} className="grid gap-3">
      <Field key={`name-${scene.name}`} label={t("scene.name")}>
        {(control) => <Input {...control} name="name" defaultValue={scene.name} required maxLength={80} />}
      </Field>
      <GridTypeSelect key={`type-${scene.gridType}`} defaultValue={scene.gridType} />
      <div className="grid grid-cols-3 items-end gap-2">
        <Field key={`size-${scene.gridSize}`} label={t("scene.gridSize")}>
          {(control) => <Input {...control} name="gridSize" type="number" min={10} max={500} defaultValue={scene.gridSize} />}
        </Field>
        <Field key={`distance-${scene.gridDistance}`} label={t("scene.gridDistance")}>
          {(control) => <Input {...control} name="gridDistance" type="number" min={0.1} step="any" defaultValue={scene.gridDistance} />}
        </Field>
        <Field key={`unit-${scene.distanceUnit}`} label={t("scene.distanceUnit")}>
          {(control) => <Input {...control} name="distanceUnit" list="distance-units" defaultValue={scene.distanceUnit} maxLength={10} />}
        </Field>
      </div>
      {!scene.bakedLighting && <AmbientLightField key={`light-${scene.ambientLight}`} defaultValue={scene.ambientLight} />}
      <Field key={`vision-${scene.visionEnabled}`} label={t("scene.vision")} hint={t("scene.visionHint")} inline>
        {(control) => <Checkbox {...control} name="visionEnabled" defaultChecked={scene.visionEnabled} />}
      </Field>
      <Field key={`radius-${scene.visionRadius}`} label={t("scene.visionRadius")}>
        {(control) => (
          <Input {...control} name="visionRadius" type="number" min={1} max={200} step="any" defaultValue={scene.visionRadius} />
        )}
      </Field>
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
          <FilePicker
            {...control}
            name="image"
            accept="image/png,image/jpeg,image/webp,video/webm,video/mp4"
            onChange={(files) => onImageChange(files[0] ?? null)}
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
