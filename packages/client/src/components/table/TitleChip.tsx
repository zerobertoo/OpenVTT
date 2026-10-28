import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon, Logo } from "../../icons";
import { Button } from "../ui/button";
import { Tip } from "../ui/tooltip";

interface Props {
  worldName: string;
  connected: boolean;
  onShowShortcuts: () => void;
}

/** Top-left chip: way back to the world list, the world name and the connection state. */
export function TitleChip({ worldName, connected, onShowShortcuts }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <header className="chrome title-chip">
      <Tip label={t("table.back")}>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 bg-chrome-2 text-on-chrome hover:not-disabled:bg-chrome-line"
          aria-label={t("table.back")}
          onClick={() => navigate({ to: "/" })}
        >
          <Icon name="back" />
        </Button>
      </Tip>
      <Logo />
      <strong>{worldName}</strong>
      {!connected && (
        <span className="status" role="status">
          {t("table.disconnected")}
        </span>
      )}
      {/* Phones have no keyboard, so the shortcut help stays out of the way there. */}
      <Tip label={t("shortcuts.title")}>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 text-on-chrome-2 hover:not-disabled:bg-chrome-2 max-[52rem]:hidden"
          aria-label={t("shortcuts.title")}
          onClick={onShowShortcuts}
        >
          <span aria-hidden="true" className="font-bold">
            ?
          </span>
        </Button>
      </Tip>
    </header>
  );
}
