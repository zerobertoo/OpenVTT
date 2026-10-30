import type { CompendiumEntry } from "@openvtt/sdk";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export const COMPENDIUM_DRAG_TYPE = "application/x-openvtt-compendium";

/** The rules system's monsters and items. Drag one onto the map, or place it in the middle of the view. */
export function Compendium({ worldId, onPlace }: { worldId: string; onPlace: (entryId: string) => void }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<CompendiumEntry[] | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    void api
      .compendium(worldId)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [worldId]);
  if (!entries?.length) return null;
  const shown = entries.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 50);
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
              {entry.name}
              <span className="text-ink-2 text-sm"> · {t(`compendium.${entry.kind}`)}</span>
            </span>
            <Button size="sm" variant="link" onClick={() => onPlace(entry.id)}>
              {t("compendium.place")}
              <span className="sr-only"> {entry.name}</span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
