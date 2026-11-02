import type { FloorDto } from "@openvtt/shared";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";

interface Props {
  /** Bottom to top, as the scene lists them. */
  floors: Pick<FloorDto, "id" | "name">[];
  currentId: string;
  /** The floor players without a token see; marked so the game master knows where the table is. */
  tableFloorId: string;
  onChange: (floorId: string) => void;
  /** Off while previewing a player: the preview follows that player's floor. */
  disabled?: boolean;
}

/** Game master only: one button per floor, highest on top, beside the map. PageUp and PageDown do the same from the keyboard. */
export function FloorSwitcher({ floors, currentId, tableFloorId, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const current = floors.find((f) => f.id === currentId);
  return (
    <nav aria-label={t("floors.switcher")} className="floor-switcher">
      <ul className="m-0 flex list-none flex-col gap-1 rounded-[1.2rem] bg-chrome p-1.5 shadow-float">
        {[...floors].reverse().map((floor) => {
          const here = floor.id === currentId;
          return (
            <li key={floor.id}>
              <button
                type="button"
                aria-pressed={here}
                disabled={disabled}
                onClick={() => onChange(floor.id)}
                className={cn(
                  "flex w-full min-w-[4.5rem] max-w-40 cursor-pointer items-center gap-1.5 rounded-xl border-0 bg-transparent px-3 py-1.5 text-left text-on-chrome-2 text-sm",
                  "hover:not-disabled:bg-chrome-2 hover:not-disabled:text-on-chrome focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
                  "aria-pressed:bg-accent aria-pressed:text-on-accent disabled:cursor-default disabled:opacity-60 pointer-coarse:min-h-11",
                )}
              >
                <span className="truncate">{floor.name}</span>
                {floor.id === tableFloorId && (
                  <>
                    <span aria-hidden="true">●</span>
                    <span className="sr-only">{t("floors.tableFloorMark")}</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {/* Says which floor is on screen after a change, for people who do not see the map. */}
      <p role="status" className="sr-only">
        {current ? t("floors.showing", { name: current.name }) : ""}
      </p>
    </nav>
  );
}
