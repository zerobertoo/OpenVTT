import type { MapTool } from "../MapView";

export type ShortcutAction =
  | { type: "tool"; tool: MapTool }
  | { type: "togglePanels" }
  | { type: "help" }
  | { type: "deselect" }
  | { type: "diceTray" }
  | { type: "view"; kind: "zoomIn" | "zoomOut" | "fit" | "center" }
  /** Move the selected token by whole cells; each axis is -1, 0 or 1. */
  | { type: "move"; dx: number; dy: number }
  /** Turn the selected tokens by this many degrees. */
  | { type: "rotate"; degrees: number }
  /** Delete the selected tokens (the game master is asked to confirm). */
  | { type: "remove" };

const ARROWS: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
};

/** Roles whose own keyboard handling (arrow keys, letters) must not be taken over. */
const OWN_KEYBOARD_ROLES = new Set(["tab", "radio", "slider", "menuitem", "option", "textbox", "combobox", "switch", "checkbox"]);

/** True when the key press belongs to the focused control, a dialog or a menu instead of the table. */
export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return true;
  if (OWN_KEYBOARD_ROLES.has(target.getAttribute("role") ?? "")) return true;
  return target.closest("[role=dialog], [role=alertdialog], [role=menu]") !== null;
}

/** Maps a key press to a table action, or null for keys the table does not use. Modified keys are left to the browser. */
export function actionForKey(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">): ShortcutAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const arrow = ARROWS[event.key];
  if (arrow) return { type: "move", ...arrow };
  switch (event.key.toLowerCase()) {
    case "+":
    case "=":
      return { type: "view", kind: "zoomIn" };
    case "-":
      return { type: "view", kind: "zoomOut" };
    case "c":
      return { type: "view", kind: "center" };
    case "0":
      return { type: "view", kind: "fit" };
    case "v":
      return { type: "tool", tool: "select" };
    case "r":
      return { type: "tool", tool: "ruler" };
    case "p":
      return { type: "togglePanels" };
    case "d":
      return { type: "diceTray" };
    case "[":
      return { type: "rotate", degrees: -45 };
    case "]":
      return { type: "rotate", degrees: 45 };
    case "delete":
      return { type: "remove" };
    case "?":
      return { type: "help" };
    case "escape":
      return { type: "deselect" };
    default:
      return null;
  }
}
