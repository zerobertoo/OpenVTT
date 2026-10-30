import type { SceneDto, TokenDto } from "@openvtt/shared";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { hexOrientationOf, snapToHex } from "../../lib/hex";
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
        case "minimap":
          return ui.toggleMinimap();
        case "focus":
          return ui.setView(ui.view === "normal" ? "focus" : "normal");
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
            let x = Math.min(Math.max(0, token.x + action.dx * scene.gridSize), Math.max(0, scene.width - span));
            let y = Math.min(Math.max(0, token.y + action.dy * scene.gridSize), Math.max(0, scene.height - span));
            const hex = hexOrientationOf(scene.gridType);
            if (hex) {
              // Up and down land between two hexes; snapping picks the one in that direction.
              const center = snapToHex({ x: x + span / 2 + action.dx * 0.01, y: y + span / 2 }, scene.gridSize, hex);
              x = center.x - span / 2;
              y = center.y - span / 2;
            }
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
