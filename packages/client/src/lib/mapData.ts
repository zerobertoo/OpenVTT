import type { FloorDto, WallDto } from "@openvtt/shared";
import { Container, type FederatedPointerEvent, Graphics } from "pixi.js";
import { hexToNumber } from "./mapShapes";

/** What the markers do when the person interacts with them; the map view owns the state these touch. */
export interface MapDataHandlers {
  /** A door only opens or closes with the select tool. */
  canToggleDoor: () => boolean;
  /** A light marker was pressed while editing lights; the drag that follows is the caller's. */
  onLightGrab: (index: number, marker: Graphics, event: FederatedPointerEvent) => void;
  onDoorToggle: (wallId: string, open: boolean) => void;
}

const DOOR_CLOSED = 0xffb000;
const DOOR_OPEN = 0x3ddc84;

/**
 * Lights as soft discs, walls as red lines, doors as amber (closed) or green (open) lines with a handle to open them.
 * `editing` is set while the light tool is active: every light then shows, bigger, and can be grabbed.
 */
export function buildMapData(
  scene: { gridSize: number },
  floor: Pick<FloorDto, "walls" | "lights">,
  layers: { walls: boolean; doors: boolean; lights: boolean },
  editing: { selectedLight: number | null } | null,
  handlers: MapDataHandlers,
): { lights: Container; walls: Graphics; doors: Container } {
  const lights = new Container();
  floor.lights.forEach((light, index) => {
    if (!layers.lights && !editing) return;
    const picked = editing !== null && index === editing.selectedLight;
    const marker = new Graphics()
      .circle(0, 0, Math.max(4, scene.gridSize / 8) * (editing ? 1.5 : 1))
      .fill({ color: hexToNumber(light.color) })
      .stroke({ width: picked ? 4 : 2, color: picked ? 0xffffff : 0x000000 });
    marker.position.set(light.x, light.y);
    if (editing) {
      marker.eventMode = "static";
      marker.cursor = "move";
      marker.on("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        handlers.onLightGrab(index, marker, event);
      });
    }
    lights.addChild(marker);
  });
  const walls = new Graphics();
  const doors = new Container();
  const line = (g: Graphics, w: WallDto) => g.moveTo(w.x1, w.y1).lineTo(w.x2, w.y2);
  for (const wall of floor.walls) {
    if (wall.kind === "wall") {
      if (layers.walls) line(walls, wall);
      continue;
    }
    if (!layers.doors) continue;
    const color = wall.open ? DOOR_OPEN : DOOR_CLOSED;
    const door = new Graphics();
    line(door, wall).stroke({ width: wall.open ? 3 : 6, color, alpha: wall.open ? 0.7 : 1 });
    // A handle at the middle of the door: a bigger target than the line, also for touch.
    const handle = new Graphics()
      .circle((wall.x1 + wall.x2) / 2, (wall.y1 + wall.y2) / 2, Math.max(12, scene.gridSize / 4))
      .fill({ color, alpha: 0.35 });
    handle.eventMode = "static";
    handle.cursor = "pointer";
    handle.on("pointerdown", (event) => {
      if (!handlers.canToggleDoor() || event.button !== 0) return;
      event.stopPropagation();
      handlers.onDoorToggle(wall.id, !wall.open);
    });
    door.addChild(handle);
    doors.addChild(door);
  }
  walls.stroke({ width: 5, color: 0xff4d4d });
  return { lights, walls, doors };
}
