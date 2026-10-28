import type { SheetField as SheetFieldDef, SheetValue } from "@openvtt/sdk";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Field } from "../ui/field";
import { Input, Select, Textarea } from "../ui/input";

type Row = Record<string, string | number | boolean>;
type LabelSource = { id: string; label?: SheetFieldDef["label"] };

interface Props {
  field: SheetFieldDef;
  value: SheetValue;
  label: string;
  /** Resolves the translated label of a field, section or option. */
  labelFor: (item: LabelSource) => string;
  readOnly?: boolean;
  /** Called when the person finishes editing (blur or change), never on every keystroke. */
  onCommit: (value: SheetValue) => void;
}

const emptyValueOf = (field: SheetFieldDef): SheetValue => (field.type === "number" ? 0 : field.type === "checkbox" ? false : "");

/** One input of a sheet, chosen by the field type of the system's template. Inputs are uncontrolled and saved on commit. */
export function SheetField({ field, value, label, labelFor, onCommit, readOnly }: Props) {
  const { t } = useTranslation();
  switch (field.type) {
    case "computed":
      return (
        <div className="grid gap-1">
          <span className="font-semibold text-[0.9rem]">{label}</span>
          <output className="font-bold text-lg">{value === null ? "—" : String(value)}</output>
        </div>
      );
    case "number":
      return (
        <Field label={label}>
          {(control) => (
            <Input
              {...control}
              type="number"
              defaultValue={value as number}
              min={field.min}
              max={field.max}
              step="any"
              disabled={readOnly}
              onBlur={(e) => e.target.value !== "" && Number(e.target.value) !== value && onCommit(Number(e.target.value))}
            />
          )}
        </Field>
      );
    case "text":
      return (
        <Field label={label}>
          {(control) =>
            field.multiline ? (
              <Textarea
                {...control}
                defaultValue={value as string}
                rows={4}
                maxLength={5000}
                disabled={readOnly}
                onBlur={(e) => e.target.value !== value && onCommit(e.target.value)}
              />
            ) : (
              <Input
                {...control}
                defaultValue={value as string}
                maxLength={5000}
                disabled={readOnly}
                onBlur={(e) => e.target.value !== value && onCommit(e.target.value)}
              />
            )
          }
        </Field>
      );
    case "checkbox":
      return (
        <Field label={label} inline>
          {(control) => (
            <Checkbox {...control} defaultChecked={value as boolean} disabled={readOnly} onChange={(e) => onCommit(e.target.checked)} />
          )}
        </Field>
      );
    case "select":
      return (
        <Field label={label}>
          {(control) => (
            <Select {...control} defaultValue={value as string} disabled={readOnly} onChange={(e) => onCommit(e.target.value)}>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {labelFor({ id: option.value, label: option.label })}
                </option>
              ))}
            </Select>
          )}
        </Field>
      );
    case "list": {
      const rows = value as Row[];
      return (
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-1 p-0 font-semibold text-[0.9rem]">{label}</legend>
          {rows.map((row, index) => (
            // Rows have no id of their own, so the position is their identity; the form remounts after each save.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <div key={index} className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] items-end gap-2 rounded-card bg-surface-2 p-2">
              {field.itemFields.map((item) => (
                <SheetField
                  key={item.id}
                  field={item}
                  label={labelFor(item)}
                  labelFor={labelFor}
                  readOnly={readOnly}
                  value={(row[item.id] ?? emptyValueOf(item)) as SheetValue}
                  onCommit={(next) =>
                    onCommit(
                      rows.map((current, i) => (i === index ? { ...current, [item.id]: next as string | number | boolean } : current)),
                    )
                  }
                />
              ))}
              {!readOnly && (
                <Button variant="dangerLink" size="sm" onClick={() => onCommit(rows.filter((_, i) => i !== index))}>
                  {t("common.delete")}
                </Button>
              )}
            </div>
          ))}
          {!readOnly && (
            <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => onCommit([...rows, {}])}>
              {t("sheet.addRow")}
            </Button>
          )}
        </fieldset>
      );
    }
  }
}
