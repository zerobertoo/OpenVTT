import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { type MapImportDraft, MapImportError, prepareMapImports } from "../../lib/mapImport";
import { UnsupportedMediaError } from "../../lib/media";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Field } from "../ui/field";
import { Input } from "../ui/input";

/** What the game master confirmed: the drafts with name, grid and distance as edited. */
export type MapImportChoice = MapImportDraft[];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (choice: MapImportChoice) => void;
  pending?: boolean;
}

/** Pick map files (Universal VTT, a Foundry-style export, pictures or videos); check what was read, then create the scenes. */
export function MapImportDialog({ open, onOpenChange, onCreate, pending }: Props) {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<MapImportDraft[]>([]);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const pick = async (files: File[]) => {
    setDrafts([]);
    setErrorKey(null);
    if (files.length === 0) return;
    setReading(true);
    try {
      setDrafts(await prepareMapImports(files));
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
    const f = new FormData(event.currentTarget);
    onCreate(
      drafts.map((draft, i) => ({
        ...draft,
        name: String(f.get(`name-${i}`)).trim() || draft.name,
        gridSize: Number(f.get(`gridSize-${i}`)),
        gridDistance: Number(f.get(`gridDistance-${i}`)),
        distanceUnit: String(f.get(`distanceUnit-${i}`)).trim() || draft.distanceUnit,
      })),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("scene.import.title")} description={t("scene.import.description")}>
      <Field label={t("scene.import.files")} hint={t("scene.import.filesHint")}>
        {(control) => (
          <Input
            {...control}
            type="file"
            multiple
            accept=".dd2vtt,.uvtt,.json,image/png,image/jpeg,image/webp,video/webm,video/mp4"
            onChange={(e) => void pick(Array.from(e.target.files ?? []))}
          />
        )}
      </Field>
      <details className="rounded-lg bg-surface-2 p-3">
        <summary className="cursor-pointer font-semibold">{t("scene.import.guide.title")}</summary>
        <ul className="m-0 mt-2 grid gap-1.5 pl-5 text-ink-2">
          {(["universal", "foundry", "video", "image", "floors", "grid", "lights"] as const).map((step) => (
            <li key={step}>{t(`scene.import.guide.${step}`)}</li>
          ))}
        </ul>
      </details>
      {reading && <p role="status">{t("scene.import.reading")}</p>}
      {errorKey && (
        <p role="alert" className="error">
          {t(errorKey as "errors.internal_error")}
        </p>
      )}
      {drafts.length > 0 && (
        // The key restarts the uncontrolled inputs when other files are picked.
        <form
          key={drafts.map((d) => `${d.name}-${d.width}-${d.gridSize}`).join("|")}
          onSubmit={submit}
          aria-label={t("scene.import.confirm")}
          className="grid gap-4"
        >
          {drafts.map((draft, i) => (
            <fieldset key={`${draft.name}-${i}`} className="m-0 grid min-w-0 gap-3 border-0 p-0">
              {drafts.length > 1 && <legend className="mb-1 font-semibold">{draft.name}</legend>}
              <p className="m-0 text-ink-2">
                {t("scene.import.summary", {
                  size: `${draft.width}×${draft.height}`,
                  lights: draft.data?.lights.length ?? 0,
                  walls: (draft.data?.walls.length ?? 0) + (draft.data?.doors.length ?? 0),
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
                {(control) => <Input {...control} name={`name-${i}`} defaultValue={draft.name} required maxLength={80} />}
              </Field>
              <div className="grid grid-cols-3 items-end gap-2">
                <Field label={t("scene.gridSize")}>
                  {(control) => (
                    <Input {...control} name={`gridSize-${i}`} type="number" min={10} max={500} defaultValue={draft.gridSize} required />
                  )}
                </Field>
                <Field label={t("scene.gridDistance")}>
                  {(control) => (
                    <Input
                      {...control}
                      name={`gridDistance-${i}`}
                      type="number"
                      min={0.1}
                      step="any"
                      defaultValue={draft.gridDistance}
                      required
                    />
                  )}
                </Field>
                <Field label={t("scene.distanceUnit")}>
                  {(control) => (
                    <Input {...control} name={`distanceUnit-${i}`} list="distance-units" defaultValue={draft.distanceUnit} maxLength={10} />
                  )}
                </Field>
              </div>
            </fieldset>
          ))}
          <Button type="submit" pending={pending} className="justify-self-start">
            {t("scene.import.create", { count: drafts.length })}
          </Button>
        </form>
      )}
    </Dialog>
  );
}
