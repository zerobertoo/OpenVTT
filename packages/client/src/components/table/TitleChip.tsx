import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon, Logo } from "../../icons";
import { Button } from "../ui/button";
import { Tip } from "../ui/tooltip";

interface Props {
  worldName: string;
  connected: boolean;
}

/** Top-left chip: way back to the world list, the world name and the connection state. */
export function TitleChip({ worldName, connected }: Props) {
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
    </header>
  );
}
