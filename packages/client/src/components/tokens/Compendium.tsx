import { addItemToRows, type CompendiumEntry, computeSheet, itemListOf } from "@openvtt/sdk";
import type { ActorDto } from "@openvtt/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { TableActions } from "../../lib/tableActions";
import { useWorldSystem } from "../../queries";
import { ErrorMessage, useAction } from "../../ui";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";

export const COMPENDIUM_DRAG_TYPE = "application/x-openvtt-compendium";

interface Props {
  worldId: string;
  onPlace: (entryId: string) => void;
  /** Sheets of the world, to add items to. */
  actors: ActorDto[];
  /** Lets the game master undo an item added to a sheet. */
  actions: Pick<TableActions, "edited">;
}

/** The rules system's monsters and items. Drag one onto the map, place it in the middle of the view, or add an item to a sheet. */
export function Compendium({ worldId, onPlace, actors, actions }: Props) {
  const { t, i18n } = useTranslation();
  const { data: system } = useWorldSystem(worldId);
  const { run, error, pending } = useAction();
  const [entries, setEntries] = useState<CompendiumEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [sheetId, setSheetId] = useState("");
  // Only character sheets whose template has a list that accepts items can receive them (the package check covers that template only).
  const itemSheets = actors.filter((a) => a.type === "character" && itemListOf(system?.templates[a.type]));
  const target = itemSheets.find((a) => a.id === sheetId) ?? itemSheets[0];

  /** Adds the item to the list that accepts items. The list comes from the latest sheet the client holds. */
  const addToSheet = (entry: CompendiumEntry, name: string) => {
    const template = target && system?.templates[target.type];
    const list = itemListOf(template);
    if (!target || !template || !list) return;
    const before = computeSheet(template, target.data)[list.id];
    const rows = Array.isArray(before) ? before : [];
    const after = addItemToRows(list, rows, name, entry.data);
    // a full stack or a full list changes nothing: no save and no undo step
    if (JSON.stringify(after) === JSON.stringify(rows)) return;
    const sheet = target;
    void run(async () => {
      await api.updateActor(sheet.id, { data: { [list.id]: after } });
      actions.edited(sheet.id, api.updateActor, { data: { [list.id]: rows } }, { data: { [list.id]: after } });
    });
  };
  useEffect(() => {
    void api
      .compendium(worldId)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [worldId]);
  if (!entries?.length) return null;
  const nameOf = (entry: CompendiumEntry) => entry.names?.[i18n.language.toLowerCase()] ?? entry.name;
  const needle = query.trim().toLowerCase();
  // The search matches the shown name and the original one, so both "Goblin" and "Lobo" find what they mean.
  const shown = entries.filter((e) => nameOf(e).toLowerCase().includes(needle) || e.name.toLowerCase().includes(needle)).slice(0, 50);
  return (
    <section aria-label={t("compendium.title")} className="grid gap-2">
      <h3>{t("compendium.title")}</h3>
      <p className="m-0 text-ink-2 text-sm">{t("compendium.hint")}</p>
      <Input
        type="search"
        aria-label={t("compendium.search")}
        placeholder={t("compendium.search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {itemSheets.length > 0 && (
        <Select aria-label={t("compendium.sheet")} value={target?.id} onValueChange={(value) => setSheetId(value)}>
          {itemSheets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      )}
      <ErrorMessage error={error} />
      <ul aria-label={t("compendium.title")} className="m-0 grid list-none gap-1 p-0">
        {shown.map((entry) => (
          <li
            key={entry.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData(COMPENDIUM_DRAG_TYPE, entry.id)}
            className="flex cursor-grab items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-2"
          >
            <span aria-hidden="true" className="size-3 flex-none rounded-full" style={{ background: entry.color }} />
            <span className="min-w-0 flex-1 truncate">
              {nameOf(entry)}
              <span className="text-ink-2 text-sm"> · {t(`compendium.${entry.kind}`)}</span>
            </span>
            <Button size="sm" variant="link" onClick={() => onPlace(entry.id)}>
              {t("compendium.place")}
              <span className="sr-only"> {nameOf(entry)}</span>
            </Button>
            {entry.kind === "item" && target && (
              <Button size="sm" variant="link" disabled={pending} onClick={() => addToSheet(entry, nameOf(entry))}>
                {t("compendium.addToSheet")}
                <span className="sr-only"> {`${nameOf(entry)} · ${target.name}`}</span>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
