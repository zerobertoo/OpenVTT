import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../icons";
import type { MapTool } from "../../MapView";
import { DockButton, DockGroup } from "../ui/dock";
import { ToolbarChoices } from "../ui/toolbar";

const TOOLS = ["select", "ruler", "draw", "light"] as const satisfies readonly MapTool[];

interface Props {
  tool: MapTool;
  onToolChange: (tool: MapTool) => void;
  canDraw: boolean;
  /** Placing and editing lights is for the game master. */
  canLight: boolean;
  diceTrayOpen: boolean;
  onToggleDiceTray: () => void;
  /** The game master's layers menu; players have none. */
  layersMenu?: ReactNode;
}

/** Bottom-centre dock: the map tools (one is always active), and apart from them the dice tray and the layers menu. */
export function MapToolbar({ tool, onToolChange, canDraw, canLight, diceTrayOpen, onToggleDiceTray, layersMenu }: Props) {
  const { t } = useTranslation();
  return (
    <div className="dock flex items-stretch gap-2">
      <ToolbarChoices
        label={t("map.tools")}
        value={tool}
        onValueChange={onToolChange}
        choices={TOOLS.filter((id) => (canDraw || id !== "draw") && (canLight || id !== "light")).map((id) => ({
          value: id,
          label: t(`map.${id}`),
          icon: <Icon name={id} />,
        }))}
      />
      <DockGroup role="group" aria-label={t("map.utilities")}>
        <DockButton aria-pressed={diceTrayOpen} onClick={onToggleDiceTray}>
          <Icon name="dice" />
          {t("dice.title")}
        </DockButton>
        {layersMenu}
      </DockGroup>
    </div>
  );
}
