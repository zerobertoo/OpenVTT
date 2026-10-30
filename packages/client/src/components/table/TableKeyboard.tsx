import type { SceneDto, TokenDto } from "@openvtt/shared";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { actionForKey, isTypingTarget } from "../../lib/shortcuts";
import { useTableUi } from "../../tableStore";
import { ShortcutHelp } from "./ShortcutHelp";

interface Props {
  scene: SceneDto | null;
  /** The selected tokens the person may move. */
  movableTokens: TokenDto[];
  onMove: (tokenId: string, x: number, y: number) => void;
  onRotate: (degrees: number) => void;
  onRemove: () => void;
  /** Lets the title chip's help button open the same dialog. */
  helpOpen: boolean;
  onHelpOpenChange: (open: boolean) => void;
}

/** Keyboard shortcuts for the table, the help dialog and a live region that says where a moved token landed. */
export function TableKeyboard({ scene, movableTokens, onMove, onRotate, onRemove, helpOpen, onHelpOpenChange }: Props) {
  const { t } = useTranslation();
  const [announcement, setAnnouncement] = useState("");
  // The handler is attached once and reads the newest props through this ref.
  const latest = useRef({ scene, movableTokens, onMove, onRotate, onRemove });
  latest.current = { scene, movableTokens, onMove, onRotate, onRemove };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      const action = actionForKey(event);
      if (!action) return;
      const ui = useTableUi.getState();
      const { scene, movableTokens, onMove, onRotate, onRemove } = latest.current;
      switch (action.type) {
        case "tool":
          return ui.setTool(action.tool);
        case "togglePanels":
          return ui.toggleDrawer();
        case "help":
          return onHelpOpenChange(true);
        case "deselect":
          return ui.selectToken(null);
        case "diceTray":
          return ui.setDiceTrayOpen(!ui.diceTrayOpen);
        case "view":
          return ui.changeView(action.kind);
        case "rotate":
          return onRotate(action.degrees);
        case "remove":
          return onRemove();
        case "move": {
          if (!scene || movableTokens.length === 0) return;
          event.preventDefault();
          let landed: { name: string; x: number; y: number } | null = null;
          for (const token of movableTokens) {
            const span = token.size * scene.gridSize;
            const x = Math.min(Math.max(0, token.x + action.dx * scene.gridSize), Math.max(0, scene.width - span));
            const y = Math.min(Math.max(0, token.y + action.dy * scene.gridSize), Math.max(0, scene.height - span));
            if (x === token.x && y === token.y) continue;
            onMove(token.id, x, y);
            landed = { name: token.name, x, y };
          }
          // Only a single token is announced by name; a group would be noise.
          if (!landed || movableTokens.length > 1) return;
          setAnnouncement(
            t("shortcuts.moved", {
              name: landed.name,
              column: Math.round(landed.x / scene.gridSize) + 1,
              row: Math.round(landed.y / scene.gridSize) + 1,
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
