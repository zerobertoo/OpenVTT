import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { type MapImportDraft, MapImportError, prepareMapImport } from "../../lib/mapImport";
import { UnsupportedMediaError } from "../../lib/media";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Field } from "../ui/field";
import { Input } from "../ui/input";

/** What the game master confirmed: the draft with the name, grid and distance as edited. */
export type MapImportChoice = MapImportDraft;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (choice: MapImportChoice) => void;
  pending?: boolean;
}

/** Pick a Universal VTT file with its picture or video, or a plain map file; check what was read, then create the scene. */
export function MapImportDialog({ open, onOpenChange, onCreate, pending }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<MapImportDraft | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const pick = async (files: File[]) => {
    setDraft(null);
    setErrorKey(null);
    if (files.length === 0) return;
    setReading(true);
    try {
      setDraft(await prepareMapImport(files));
    } catch (error) {
      if (error instanceof MapImportError) setErrorKey(`scene.import.error.${error.code}`);
      else if (error instanceof UnsupportedMediaError) setErrorKey("errors.video_unsupported");
      else setErrorKey("errors.internal_error");
    } finally {
      setReading(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    const f = new FormData(event.currentTarget);
    onCreate({
      ...draft,
      name: String(f.get("name")).trim() || draft.name,
      gridSize: Number(f.get("gridSize")),
      gridDistance: Number(f.get("gridDistance")),
      distanceUnit: String(f.get("distanceUnit")).trim() || draft.distanceUnit,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("scene.import.title")} description={t("scene.import.description")}>
      <Field label={t("scene.import.files")} hint={t("scene.import.filesHint")}>
        {(control) => (
          <Input
            {...control}
            type="file"
            multiple
            accept=".dd2vtt,.uvtt,image/png,image/jpeg,image/webp,video/webm,video/mp4"
            onChange={(e) => void pick(Array.from(e.target.files ?? []))}
          />
        )}
      </Field>
      {reading && <p role="status">{t("scene.import.reading")}</p>}
      {errorKey && (
        <p role="alert" className="error">
          {t(errorKey as "errors.internal_error")}
        </p>
      )}
      {draft && (
        // The key restarts the uncontrolled inputs when another file is picked.
        <form
          key={`${draft.name}-${draft.width}-${draft.gridSize}`}
          onSubmit={submit}
          aria-label={t("scene.import.confirm")}
          className="grid gap-3"
        >
          <p className="m-0 text-ink-2">
            {t("scene.import.summary", {
              size: `${draft.width}×${draft.height}`,
              lights: draft.uvtt?.lights.length ?? 0,
              walls: (draft.uvtt?.walls.length ?? 0) + (draft.uvtt?.doors.length ?? 0),
            })}
          </p>
          {draft.warnings.length > 0 && (
            <ul aria-label={t("scene.import.warnings")} className="m-0 grid gap-1 pl-5 text-ink-2">
              {draft.warnings.map((w) => (
                <li key={w}>{t(`scene.import.warning.${w}`)}</li>
              ))}
            </ul>
          )}
          <Field label={t("scene.name")}>
            {(control) => <Input {...control} name="name" defaultValue={draft.name} required maxLength={80} />}
          </Field>
          <div className="grid grid-cols-3 items-end gap-2">
            <Field label={t("scene.gridSize")}>
              {(control) => <Input {...control} name="gridSize" type="number" min={10} max={500} defaultValue={draft.gridSize} required />}
            </Field>
            <Field label={t("scene.gridDistance")}>
              {(control) => (
                <Input {...control} name="gridDistance" type="number" min={0.1} step="any" defaultValue={draft.gridDistance} required />
              )}
            </Field>
            <Field label={t("scene.distanceUnit")}>
              {(control) => (
                <Input {...control} name="distanceUnit" list="distance-units" defaultValue={draft.distanceUnit} maxLength={10} />
              )}
            </Field>
          </div>
          <Button type="submit" pending={pending} className="justify-self-start">
            {t("scene.create")}
          </Button>
        </form>
      )}
    </Dialog>
  );
}
