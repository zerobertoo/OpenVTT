import { computeSheet, resolveLabel, type SheetField as SheetFieldDef, type SheetTemplate, type SheetValue } from "@openvtt/sdk";
import type { ActorDto, SystemInfoDto } from "@openvtt/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "../ui/card";
import { SheetField } from "./SheetField";

interface Props {
  actor: ActorDto;
  template: SheetTemplate;
  system: SystemInfoDto;
  locale: string;
  /** Called with the field id and its new value. */
  onSave: (fieldId: string, value: SheetValue) => void;
}

export type SaveState = "idle" | "saving" | "saved";

/** Sheet of an actor, rendered from the system's template: one card per section. */
export function SheetView({ actor, template, system, locale, onSave }: Props) {
  const values = useMemo(() => computeSheet(template, actor.data), [template, actor.data]);
  const labelFor = (item: { id: string; label?: SheetFieldDef["label"] }) => resolveLabel(item.label, locale, system.strings, item.id);

  return (
    // Remounting on server changes keeps uncontrolled inputs in sync with computed values.
    <form key={JSON.stringify(actor.data) + JSON.stringify(template)} onSubmit={(e) => e.preventDefault()} className="grid gap-3">
      {template.sections.map((section) => (
        <Card key={section.id} variant="inset" as="section" aria-labelledby={`${actor.id}-${section.id}`} className="grid gap-3">
          <h4 id={`${actor.id}-${section.id}`} className="m-0 text-base">
            {labelFor(section)}
          </h4>
          {section.fields.map((field) => (
            <SheetField
              key={field.id}
              field={field}
              label={labelFor(field)}
              labelFor={labelFor}
              value={values[field.id] ?? null}
              onCommit={(value) => onSave(field.id, value)}
            />
          ))}
        </Card>
      ))}
    </form>
  );
}

/** "Saving…" / "All changes saved". A polite live region, so the result of leaving a field is announced. */
export function SaveStatus({ state }: { state: SaveState }) {
  const { t } = useTranslation();
  return (
    <p role="status" className="m-0 min-h-5 text-ink-2 text-sm">
      {state === "saving" ? t("sheet.saving") : state === "saved" ? t("sheet.saved") : ""}
    </p>
  );
}
