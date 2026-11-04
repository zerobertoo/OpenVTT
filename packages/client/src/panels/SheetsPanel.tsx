import { computeSheet, type SheetValue } from "@openvtt/sdk";
import { tableRole, type WorldStateDto } from "@openvtt/shared";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { ActorList } from "../components/sheets/ActorList";
import { type SaveState, SaveStatus, SheetView } from "../components/sheets/SheetView";
import { Button } from "../components/ui/button";
import { ConfirmDialog } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { Field } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { PanelSection } from "../components/ui/panel-section";
import { Select } from "../components/ui/select";
import { Loading, Skeleton } from "../components/ui/skeleton";
import type { TableActions } from "../lib/tableActions";
import { queryKeys, useWorldSystem } from "../queries";
import { ErrorMessage, useAction } from "../ui";

interface Props {
  state: WorldStateDto;
  locale: string;
  /** Lets the game master undo what was just saved. */
  actions: Pick<TableActions, "edited" | "actorCreated" | "actorDeleted">;
}

export function SheetsPanel({ state, locale, actions }: Props) {
  const { t } = useTranslation();
  const { run, error } = useAction();
  const queryClient = useQueryClient();
  const { data: system } = useWorldSystem(state.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isGm = tableRole(state.yourRole) === "gm";

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
      actions.actorCreated(actor);
      setSelectedId(actor.id);
      setSaveState("idle");
      form.reset();
    });
  };

  const saveField = async (fieldId: string, value: SheetValue) => {
    if (!selected) return;
    setSaveState("saving");
    // What the sheet showed before, defaults included, so undo can put it back even for a never-edited field.
    // (A computed field has no stored value and cannot be edited, so nothing is skipped for a real field.)
    const previous = template ? computeSheet(template, selected.data)[fieldId] : undefined;
    const saved = await run(async () => {
      await api.updateActor(selected.id, { data: { [fieldId]: value } });
      return true;
    });
    if (saved && previous !== undefined && previous !== null) {
      actions.edited(selected.id, api.updateActor, { data: { [fieldId]: previous } }, { data: { [fieldId]: value } });
    }
    setSaveState(saved ? "saved" : "idle");
  };

  return (
    <PanelSection title={t("sheet.title")} error={<ErrorMessage error={error} />}>
      {isGm && (
        <form onSubmit={create} className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Field label={t("sheet.name")}>{(control) => <Input {...control} name="name" required maxLength={80} />}</Field>
          <Field label={t("sheet.type")}>
            {(control) => (
              <Select {...control} name="type">
                <option value="character">{t("sheet.character")}</option>
                <option value="npc">{t("sheet.npc")}</option>
              </Select>
            )}
          </Field>
          <Button type="submit" className="col-span-2 justify-self-start">
            {t("sheet.create")}
          </Button>
        </form>
      )}

      {state.actors.length === 0 ? (
        <EmptyState title={t(isGm ? "sheet.noneGm" : "sheet.nonePlayer")} headingLevel={4} />
      ) : (
        <ActorList
          actors={state.actors}
          selectedId={selected?.id ?? null}
          onSelect={(id) => {
            setSelectedId(id);
            setSaveState("idle");
          }}
        />
      )}

      {selected && isGm && (
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Field label={t("sheet.owner")}>
            {(control) => (
              <Select
                {...control}
                value={selected.ownerId ?? ""}
                onValueChange={(value) => {
                  const before = { ownerId: selected.ownerId };
                  const after = { ownerId: value || null };
                  void run(() => api.updateActor(selected.id, after)).then(
                    (ok) => ok !== undefined && actions.edited(selected.id, api.updateActor, before, after),
                  );
                }}
              >
                <option value="">{t("sheet.noOwner")}</option>
                {state.members
                  .filter((m) => m.role === "player")
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
            {t("common.delete")}
          </Button>
          <ConfirmDialog
            open={confirmingDelete}
            onOpenChange={setConfirmingDelete}
            title={t("sheet.deleteTitle", { name: selected.name })}
            description={t("sheet.deleteBody")}
            confirmLabel={t("common.delete")}
            cancelLabel={t("common.cancel")}
            tone="danger"
            onConfirm={() => {
              setConfirmingDelete(false);
              const linkedTokenIds = state.tokens.filter((token) => token.actorId === selected.id).map((token) => token.id);
              void run(async () => {
                await api.deleteActor(selected.id);
                actions.actorDeleted(selected, linkedTokenIds);
              });
            }}
          />
        </div>
      )}

      {selected && !template && (
        <Loading label={t("app.loading")}>
          <Skeleton shape="block" className="h-40 w-full" />
        </Loading>
      )}
      {selected && template && system && (
        <>
          <SaveStatus state={saveState} />
          <SheetView actor={selected} template={template} system={system} locale={locale} onSave={saveField} />
        </>
      )}
    </PanelSection>
  );
}
