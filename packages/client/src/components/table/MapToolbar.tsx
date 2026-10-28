import { useTranslation } from "react-i18next";
import { Icon } from "../../icons";
import type { MapTool } from "../../MapView";
import { ToolbarChoices } from "../ui/toolbar";

const TOOLS = ["select", "ruler"] as const satisfies readonly MapTool[];

interface Props {
  tool: MapTool;
  onToolChange: (tool: MapTool) => void;
}

/** Bottom-centre map tools. */
export function MapToolbar({ tool, onToolChange }: Props) {
  const { t } = useTranslation();
  return (
    <ToolbarChoices
      className="dock"
      label={t("map.tools")}
      value={tool}
      onValueChange={onToolChange}
      choices={TOOLS.map((id) => ({ value: id, label: t(`map.${id}`), icon: <Icon name={id} /> }))}
    />
  );
}
