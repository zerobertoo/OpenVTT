import type { FloorDto, WallDto } from "@openvtt/shared";
import type { FederatedPointerEvent, Graphics } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { buildMapData, type MapDataHandlers } from "./mapData";

const wall = (id: string, kind: WallDto["kind"], open = false): WallDto => ({ id, x1: 0, y1: 0, x2: 100, y2: 0, kind, open });
const light = (x: number, color = "#ffcc00") => ({ id: `l${x}`, x, y: 10, radius: 4, intensity: 1, color, shadows: true, feather: 0.4 });
const floor: Pick<FloorDto, "walls" | "lights"> = {
  walls: [wall("w1", "wall"), wall("d1", "door"), wall("d2", "door", true)],
  lights: [light(10), light(20)],
};
const scene = { gridSize: 70 };
const allLayers = { walls: true, doors: true, lights: true };
const event = (button = 0) => ({ button, stopPropagation: vi.fn(), global: { x: 5, y: 6 } }) as unknown as FederatedPointerEvent;

function handlers(overrides: Partial<MapDataHandlers> = {}): MapDataHandlers {
  return { canToggleDoor: () => true, onLightGrab: vi.fn(), onDoorToggle: vi.fn(), ...overrides };
}
const build = (layers = allLayers, editing: { selectedLight: number | null } | null = null, h = handlers()) =>
  buildMapData(scene, floor, layers, editing, h);

describe("buildMapData lights", () => {
  it("places a marker at every light while the lights layer is on", () => {
    const { lights } = build();
    expect(lights.children.map((c) => [c.x, c.y])).toEqual([
      [10, 10],
      [20, 10],
    ]);
  });

  it("hides the markers when the layer is off, unless the light tool is editing them", () => {
    expect(build({ ...allLayers, lights: false }).lights.children).toHaveLength(0);
    expect(build({ ...allLayers, lights: false }, { selectedLight: null }).lights.children).toHaveLength(2);
  });

  it("makes markers draggable only while editing", () => {
    expect(build().lights.children[0]!.eventMode).not.toBe("static");
    const { lights } = build(allLayers, { selectedLight: null });
    expect(lights.children[0]!.eventMode).toBe("static");
    expect(lights.children[0]!.cursor).toBe("move");
  });

  it("hands a pressed marker to the drag handler, with the marker itself", () => {
    const h = handlers();
    const { lights } = build(allLayers, { selectedLight: 1 }, h);
    const press = event();
    lights.children[1]!.emit("pointerdown", press);
    expect(press.stopPropagation).toHaveBeenCalled();
    expect(h.onLightGrab).toHaveBeenCalledWith(1, lights.children[1] as Graphics, press);
  });

  it("ignores presses by other mouse buttons", () => {
    const h = handlers();
    const { lights } = build(allLayers, { selectedLight: null }, h);
    const press = event(2);
    lights.children[0]!.emit("pointerdown", press);
    expect(press.stopPropagation).not.toHaveBeenCalled();
    expect(h.onLightGrab).not.toHaveBeenCalled();
  });
});

describe("buildMapData walls and doors", () => {
  it("draws one container per door and none while the doors layer is off", () => {
    expect(build().doors.children).toHaveLength(2);
    expect(build({ ...allLayers, doors: false }).doors.children).toHaveLength(0);
  });

  it("draws plain walls into a single shape, and only while the walls layer is on", () => {
    const withWalls = build().walls;
    const without = build({ ...allLayers, walls: false }).walls;
    expect(withWalls.bounds.width).toBeGreaterThan(90);
    expect(without.bounds.width).toBe(0);
  });

  it("toggles a door the opposite way when its handle is pressed", () => {
    const h = handlers();
    const { doors } = build(allLayers, null, h);
    const press = event();
    // The handle is the only child of a door's shape.
    const [closedDoor, openDoor] = doors.children;
    closedDoor!.children[0]!.emit("pointerdown", press);
    openDoor!.children[0]!.emit("pointerdown", event());
    expect(press.stopPropagation).toHaveBeenCalled();
    expect(h.onDoorToggle).toHaveBeenNthCalledWith(1, "d1", true);
    expect(h.onDoorToggle).toHaveBeenNthCalledWith(2, "d2", false);
  });

  it("leaves a door alone when toggling is not allowed right now or another button was used", () => {
    const h = handlers({ canToggleDoor: () => false });
    const { doors } = build(allLayers, null, h);
    const press = event();
    doors.children[0]!.children[0]!.emit("pointerdown", press);
    expect(press.stopPropagation).not.toHaveBeenCalled();
    expect(h.onDoorToggle).not.toHaveBeenCalled();

    const other = handlers();
    build(allLayers, null, other).doors.children[0]!.children[0]!.emit("pointerdown", event(2));
    expect(other.onDoorToggle).not.toHaveBeenCalled();
  });
});
