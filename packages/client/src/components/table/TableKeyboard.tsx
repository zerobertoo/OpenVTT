import type { SceneDto, TokenDto } from "@openvtt/shared";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { actionForKey, isTypingTarget } from "../../lib/shortcuts";
import { useTableUi } from "../../tableStore";
import { ShortcutHelp } from "./ShortcutHelp";

interface Props {
  scene: SceneDto | null;
  /** The selected token, if the person may move it. */
  movableToken: TokenDto | null;
  onMove: (tokenId: string, x: number, y: number) => void;
  /** Lets the title chip's help button open the same dialog. */
  helpOpen: boolean;
  onHelpOpenChange: (open: boolean) => void;
}

/** Keyboard shortcuts for the table, the help dialog and a live region that says where a moved token landed. */
export function TableKeyboard({ scene, movableToken, onMove, helpOpen, onHelpOpenChange }: Props) {
  const { t } = useTranslation();
  const [announcement, setAnnouncement] = useState("");
  // The handler is attached once and reads the newest props through this ref.
  const latest = useRef({ scene, movableToken, onMove, helpOpen });
  latest.current = { scene, movableToken, onMove, helpOpen };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      const action = actionForKey(event);
      if (!action) return;
      const ui = useTableUi.getState();
      const { scene, movableToken, onMove } = latest.current;
      switch (action.type) {
        case "tool":
          return ui.setTool(action.tool);
        case "togglePanels":
          return ui.toggleDrawer();
        case "help":
          return onHelpOpenChange(true);
        case "deselect":
          return ui.selectToken(null);
        case "view":
          return ui.changeView(action.kind);
        case "move": {
          if (!scene || !movableToken) return;
          event.preventDefault();
          const span = movableToken.size * scene.gridSize;
          const x = Math.min(Math.max(0, movableToken.x + action.dx * scene.gridSize), Math.max(0, scene.width - span));
          const y = Math.min(Math.max(0, movableToken.y + action.dy * scene.gridSize), Math.max(0, scene.height - span));
          if (x === movableToken.x && y === movableToken.y) return;
          onMove(movableToken.id, x, y);
          setAnnouncement(
            t("shortcuts.moved", {
              name: movableToken.name,
              column: Math.round(x / scene.gridSize) + 1,
              row: Math.round(y / scene.gridSize) + 1,
            }),
          );
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [t, onHelpOpenChange]);

  return (
    <>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <ShortcutHelp open={helpOpen} onOpenChange={onHelpOpenChange} />
    </>
  );
}
