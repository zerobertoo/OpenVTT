import { computeSheet, resolveLabel, type SheetField, type SheetTemplate, type SheetValue } from "@openvtt/sdk";
import type { ActorDto, SystemInfoDto, WorldStateDto } from "@openvtt/shared";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { queryKeys, useWorldSystem } from "../queries";
import { ErrorMessage, useAction } from "../ui";

type Row = Record<string, string | number | boolean>;

interface FieldProps {
  field: SheetField;
  value: SheetValue;
  label: string;
  labelFor: (field: { id: string; label?: SheetField["label"] }) => string;
  readOnly?: boolean;
  onCommit: (value: SheetValue) => void;
}

function FieldInput({ field, value, label, labelFor, onCommit, readOnly }: FieldProps) {
  const { t } = useTranslation();
  switch (field.type) {
    case "computed":
      return (
        <label>
          {label}
          <output>{value === null ? "—" : String(value)}</output>
        </label>
      );
    case "number":
      return (
        <label>
          {label}
          <input
            type="number"
            defaultValue={value as number}
            min={field.min}
            max={field.max}
            step="any"
            disabled={readOnly}
            onBlur={(e) => e.target.value !== "" && Number(e.target.value) !== value && onCommit(Number(e.target.value))}
          />
        </label>
      );
    case "text":
      return field.multiline ? (
        <label>
          {label}
          <textarea
            defaultValue={value as string}
            rows={4}
            maxLength={5000}
            disabled={readOnly}
            onBlur={(e) => e.target.value !== value && onCommit(e.target.value)}
          />
        </label>
      ) : (
        <label>
          {label}
          <input
            defaultValue={value as string}
            maxLength={5000}
            disabled={readOnly}
            onBlur={(e) => e.target.value !== value && onCommit(e.target.value)}
          />
        </label>
      );
    case "checkbox":
      return (
        <label className="inline">
          <input type="checkbox" defaultChecked={value as boolean} disabled={readOnly} onChange={(e) => onCommit(e.target.checked)} />{" "}
          {label}
        </label>
      );
    case "select":
      return (
        <label>
          {label}
          <select defaultValue={value as string} disabled={readOnly} onChange={(e) => onCommit(e.target.value)}>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {labelFor({ id: o.value, label: o.label })}
              </option>
            ))}
          </select>
        </label>
      );
    case "list": {
      const rows = value as Row[];
      const update = (next: Row[]) => onCommit(next);
      return (
        <fieldset>
          <legend>{label}</legend>
          {rows.map((row, i) => (
            <div className="row" key={i}>
              {field.itemFields.map((item) => (
                <FieldInput
                  key={item.id}
                  field={item}
                  label={labelFor(item)}
                  labelFor={labelFor}
                  readOnly={readOnly}
                  value={(row[item.id] ?? (item.type === "number" ? 0 : item.type === "checkbox" ? false : "")) as SheetValue}
                  onCommit={(v) => update(rows.map((r, j) => (j === i ? { ...r, [item.id]: v as string | number | boolean } : r)))}
                />
              ))}
              {!readOnly && (
                <button type="button" className="link danger" onClick={() => update(rows.filter((_, j) => j !== i))}>
                  {t("common.delete")}
                </button>
              )}
            </div>
          ))}
          {!readOnly && (
            <button type="button" className="secondary" onClick={() => update([...rows, {}])}>
              {t("sheet.addRow")}
            </button>
          )}
        </fieldset>
      );
    }
  }
}

function SheetForm({
  actor,
  template,
  system,
  locale,
}: {
  actor: ActorDto;
  template: SheetTemplate;
  system: SystemInfoDto;
  locale: string;
}) {
  const { run, error } = useAction();
  const values = useMemo(() => computeSheet(template, actor.data), [template, actor.data]);
  const labelFor = (item: { id: string; label?: SheetField["label"] }) => resolveLabel(item.label, locale, system.strings, item.id);

  return (
    // Remounting on server changes keeps uncontrolled inputs in sync with computed values.
    <form key={JSON.stringify(actor.data) + JSON.stringify(template)} onSubmit={(e) => e.preventDefault()} className="sheet">
      {template.sections.map((section) => (
        <fieldset key={section.id}>
          <legend>{labelFor(section)}</legend>
          {section.fields.map((field) => (
            <FieldInput
              key={field.id}
              field={field}
              label={labelFor(field)}
              labelFor={labelFor}
              value={values[field.id] ?? null}
              onCommit={(value) => run(() => api.updateActor(actor.id, { data: { [field.id]: value } }))}
            />
          ))}
        </fieldset>
      ))}
      <ErrorMessage error={error} />
    </form>
  );
}

export function SheetsPanel({ state, locale }: { state: WorldStateDto; locale: string }) {
  const { t } = useTranslation();
  const { run, error } = useAction();
  const queryClient = useQueryClient();
  const { data: system } = useWorldSystem(state.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isGm = state.yourRole === "gm";

  // The server rebuilds `state.actors` on every change, including template edits by the GM.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `state.actors` is the trigger, not a value read inside
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.worldSystem(state.id) });
  }, [queryClient, state.id, state.actors]);

  const selected = state.actors.find((a) => a.id === (selectedId ?? state.actors[0]?.id)) ?? null;
  const template = selected && system?.templates[selected.type];

  const create = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    void run(async () => {
      const actor = await api.createActor(state.id, String(f.get("name")), String(f.get("type")));
      setSelectedId(actor.id);
      form.reset();
    });
  };

  return (
    <section aria-label={t("sheet.title")}>
      <h3>{t("sheet.title")}</h3>
      {state.actors.length === 0 && <p className="muted">{t(isGm ? "sheet.noneGm" : "sheet.nonePlayer")}</p>}
      <ul className="plain">
        {state.actors.map((a) => (
          <li key={a.id}>
            <button
              className={a.id === selected?.id ? "" : "secondary"}
              aria-pressed={a.id === selected?.id}
              onClick={() => setSelectedId(a.id)}
            >
              {a.name}
            </button>
            <span className="muted">{t(a.type === "npc" ? "sheet.npc" : "sheet.character")}</span>
          </li>
        ))}
      </ul>
      {isGm && (
        <form onSubmit={create} className="row">
          <input name="name" required maxLength={80} placeholder={t("sheet.name")} aria-label={t("sheet.name")} />
          <select name="type" aria-label={t("sheet.type")}>
            <option value="character">{t("sheet.character")}</option>
            <option value="npc">{t("sheet.npc")}</option>
          </select>
          <button type="submit">{t("sheet.create")}</button>
        </form>
      )}
      {selected && isGm && (
        <div className="row">
          <label>
            {t("sheet.owner")}
            <select
              value={selected.ownerId ?? ""}
              onChange={(e) => run(() => api.updateActor(selected.id, { ownerId: e.target.value || null }))}
            >
              <option value="">{t("sheet.noOwner")}</option>
              {state.members
                .filter((m) => m.role === "player")
                .map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName}
                  </option>
                ))}
            </select>
          </label>
          <button className="danger" onClick={() => run(() => api.deleteActor(selected.id))}>
            {t("common.delete")}
          </button>
        </div>
      )}
      {selected && template && system && <SheetForm actor={selected} template={template} system={system} locale={locale} />}
      <ErrorMessage error={error} />
    </section>
  );
}
