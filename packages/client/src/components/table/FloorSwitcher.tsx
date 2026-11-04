import type { FloorDto } from "@openvtt/shared";
import { useTranslation } from "react-i18next";
import { DockButton, DockGroup } from "../ui/dock";

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
      <DockGroup as="ul" className="m-0 list-none flex-col">
        {[...floors].reverse().map((floor) => {
          const here = floor.id === currentId;
          return (
            <li key={floor.id}>
              <DockButton
                aria-pressed={here}
                disabled={disabled}
                onClick={() => onChange(floor.id)}
                className="w-full min-w-18 max-w-40 flex-row justify-start gap-1.5 px-3 py-1.5 text-left text-sm"
              >
                <span className="truncate">{floor.name}</span>
                {floor.id === tableFloorId && (
                  <>
                    <span aria-hidden="true">●</span>
                    <span className="sr-only">{t("floors.tableFloorMark")}</span>
                  </>
                )}
              </DockButton>
            </li>
          );
        })}
      </DockGroup>
      {/* Says which floor is on screen after a change, for people who do not see the map. */}
      <p role="status" className="sr-only">
        {current ? t("floors.showing", { name: current.name }) : ""}
      </p>
    </nav>
  );
}
