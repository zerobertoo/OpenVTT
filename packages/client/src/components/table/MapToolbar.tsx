import { useTranslation } from "react-i18next";
import { Icon } from "../../icons";
import type { MapTool } from "../../MapView";
import { ToolbarChoices } from "../ui/toolbar";

const TOOLS = ["select", "ruler"] as const satisfies readonly MapTool[];

interface Props {
  tool: MapTool;
  onToolChange: (tool: MapTool) => void;
  diceTrayOpen: boolean;
  onToggleDiceTray: () => void;
}

/** Bottom-centre map tools, and the button that opens the dice tray next to them. */
export function MapToolbar({ tool, onToolChange, diceTrayOpen, onToggleDiceTray }: Props) {
  const { t } = useTranslation();
  return (
    <div className="dock flex items-stretch gap-2">
      <ToolbarChoices
        label={t("map.tools")}
        value={tool}
        onValueChange={onToolChange}
        choices={TOOLS.map((id) => ({ value: id, label: t(`map.${id}`), icon: <Icon name={id} /> }))}
      />
      <button
        type="button"
        aria-pressed={diceTrayOpen}
        onClick={onToggleDiceTray}
        className="flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[1.2rem] border-0 bg-chrome px-4 text-[0.78rem] text-on-chrome-2 shadow-float hover:bg-chrome-2 hover:text-on-chrome focus-visible:outline-2 focus-visible:outline-dice focus-visible:outline-offset-2 aria-pressed:bg-dice aria-pressed:text-on-dice"
      >
        <Icon name="dice" />
        {t("dice.title")}
      </button>
    </div>
  );
}
