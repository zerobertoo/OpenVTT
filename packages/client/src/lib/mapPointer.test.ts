import type { DrawingDto, FloorDto, SceneDto, TokenDto } from "@openvtt/shared";
import { Container, type FederatedPointerEvent, Graphics, Text } from "pixi.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapPointerController, type PointerProps } from "./mapPointer";

const scene = { id: "s1", gridType: "square", gridSize: 70, width: 1000, height: 800, lockedLayers: [] as string[] } as unknown as SceneDto;
const floor = (drawings: Partial<DrawingDto>[] = []) => ({ id: "f1", drawings }) as unknown as FloorDto;
const token = (id: string, x: number, y: number) => ({ id, sceneId: "s1", x, y, size: 1 }) as unknown as TokenDto;

let stage: Container;
let world: Container;
let ruler: Graphics;
let label: Text;
let props: PointerProps;
let controller: MapPointerController;
const replacement = vi.fn();

function event(x: number, y: number, extra: Partial<{ button: number; altKey: boolean; shiftKey: boolean; target: unknown }> = {}) {
  return { global: { x, y }, button: 0, altKey: false, shiftKey: false, target: stage, ...extra } as unknown as FederatedPointerEvent;
}
const drag = (from: [number, number], to: [number, number], extra: Parameters<typeof event>[2] = {}) => {
  controller.pointerDown(event(...from, extra));
  controller.pointerMove(event(...to, extra));
  controller.pointerUp(event(...to, extra));
};

beforeEach(() => {
  stage = new Container();
  world = new Container();
  ruler = new Graphics();
  label = new Text({ text: "" });
  replacement.mockReset();
  props = {
    tool: "select",
    scene,
    floor: floor(),
    tokens: [],
    draw: { kind: "free", color: "#ff0000", text: "", layer: "objects" },
    rulerShape: "line",
    diagonalRule: "exact",
    formatDistance: (cells) => `${cells} cells`,
    canErase: () => true,
    onPing: vi.fn(),
    onSelect: vi.fn(),
    onSelectMany: vi.fn(),
    onAddLight: vi.fn(),
    onMoveLight: vi.fn(),
    onEffectPoint: vi.fn(),
    onDraw: vi.fn(),
    onErase: vi.fn(),
  };
  controller = new MapPointerController(stage, world, ruler, label, () => props, replacement);
});

describe("pings", () => {
  it("alt+click marks the map point, and shift asks everybody to look", () => {
    world.position.set(100, 50);
    controller.pointerDown(event(300, 250, { altKey: true }));
    controller.pointerDown(event(300, 250, { altKey: true, shiftKey: true }));
    expect(props.onPing).toHaveBeenNthCalledWith(1, 200, 200, false);
    expect(props.onPing).toHaveBeenNthCalledWith(2, 200, 200, true);
  });
});

describe("panning", () => {
  it("drags the map with the select tool on the empty background, and clears the selection", () => {
    controller.pointerDown(event(100, 100));
    controller.pointerMove(event(150, 120));
    expect([world.x, world.y]).toEqual([50, 20]);
    expect(props.onSelect).toHaveBeenCalledWith(null);
    controller.pointerUp(event(150, 120));
    controller.pointerMove(event(400, 400));
    expect([world.x, world.y]).toEqual([50, 20]);
  });

  it("pans with the middle button whatever the tool, without touching the selection", () => {
    props.tool = "draw";
    controller.pointerDown(event(10, 10, { button: 1 }));
    controller.pointerMove(event(30, 40));
    expect([world.x, world.y]).toEqual([20, 30]);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("does not pan when the press landed on something other than the background", () => {
    controller.pointerDown(event(10, 10, { target: new Container() }));
    controller.pointerMove(event(90, 90));
    expect([world.x, world.y]).toEqual([0, 0]);
  });

  it("stops at once when a pinch begins", () => {
    controller.pointerDown(event(0, 0));
    controller.cancelGestures();
    controller.pointerMove(event(80, 80));
    expect([world.x, world.y]).toEqual([0, 0]);
  });
});

describe("box selection", () => {
  it("selects the tokens whose centre is inside the box dragged with shift", () => {
    props.tokens = [token("in", 20, 20), token("out", 600, 600)];
    drag([0, 0], [200, 200], { shiftKey: true });
    expect(props.onSelectMany).toHaveBeenCalledWith(["in"]);
    // Shift+drag selects; it does not pan or clear the selection first.
    expect(props.onSelect).not.toHaveBeenCalled();
    expect([world.x, world.y]).toEqual([0, 0]);
  });
});

describe("single clicks by tool", () => {
  it("places a light on empty background with the light tool, but not on a token", () => {
    props.tool = "light";
    controller.pointerDown(event(40, 50));
    controller.pointerDown(event(60, 70, { target: new Container() }));
    expect(props.onAddLight).toHaveBeenCalledTimes(1);
    expect(props.onAddLight).toHaveBeenCalledWith(40, 50);
  });

  it("reports the point to the effect tool wherever it lands", () => {
    props.tool = "effect";
    controller.pointerDown(event(40, 50, { target: new Container() }));
    expect(props.onEffectPoint).toHaveBeenCalledWith(40, 50);
  });
});

describe("ruler", () => {
  it("shows the distance while dragging and keeps it after release", () => {
    props.tool = "ruler";
    controller.pointerDown(event(0, 0));
    controller.pointerMove(event(210, 0));
    expect(label.text).toBe("3 cells");
    controller.pointerUp(event(210, 0));
    controller.pointerMove(event(700, 0));
    expect(label.text).toBe("3 cells");
  });

  it("labels the label against the zoom so it stays readable", () => {
    props.tool = "ruler";
    world.scale.set(2);
    controller.pointerDown(event(0, 0));
    controller.pointerMove(event(140, 0));
    expect(label.scale.x).toBe(0.5);
  });

  it("measures both sides of a rectangle", () => {
    props.tool = "ruler";
    props.rulerShape = "rectangle";
    controller.pointerDown(event(0, 0));
    controller.pointerMove(event(140, 70));
    expect(label.text).toBe("2 cells × 1 cells");
  });
});

describe("drawing", () => {
  beforeEach(() => {
    props.tool = "draw";
  });

  it("sends a free-hand stroke on release", () => {
    drag([0, 0], [50, 0]);
    expect(props.onDraw).toHaveBeenCalledWith({ kind: "free", layer: "objects", points: [0, 0, 50, 0], color: "#ff0000", text: "" });
  });

  it("ignores a stray click that never went anywhere", () => {
    drag([0, 0], [1, 1]);
    expect(props.onDraw).not.toHaveBeenCalled();
  });

  it("refuses to draw on a locked layer", () => {
    (scene as unknown as { lockedLayers: string[] }).lockedLayers = ["objects"];
    drag([0, 0], [50, 0]);
    (scene as unknown as { lockedLayers: string[] }).lockedLayers = [];
    expect(props.onDraw).not.toHaveBeenCalled();
  });

  it("puts text where it was clicked, and nothing when the text is empty", () => {
    props.draw = { kind: "text", color: "#00ff00", text: "  ", layer: "objects" };
    controller.pointerDown(event(10, 20));
    expect(props.onDraw).not.toHaveBeenCalled();
    props.draw = { kind: "text", color: "#00ff00", text: "Cave", layer: "objects" };
    controller.pointerDown(event(10, 20));
    expect(props.onDraw).toHaveBeenCalledWith({ kind: "text", layer: "objects", points: [10, 20], color: "#00ff00", text: "Cave" });
  });

  it("notes always go on the game master's layer for the lock check", () => {
    (scene as unknown as { lockedLayers: string[] }).lockedLayers = ["gm"];
    props.draw = { kind: "note", color: "#00ff00", text: "Trap", layer: "objects" };
    controller.pointerDown(event(10, 20));
    (scene as unknown as { lockedLayers: string[] }).lockedLayers = [];
    expect(props.onDraw).not.toHaveBeenCalled();
  });

  it("leaves marks on a locked layer alone when erasing", () => {
    props.floor = floor([{ id: "d1", kind: "line", layer: "objects", points: [0, 0, 100, 0] }]);
    props.draw = { kind: "erase", color: "#000000", text: "", layer: "objects" };
    (scene as unknown as { lockedLayers: string[] }).lockedLayers = ["objects"];
    controller.pointerDown(event(50, 3));
    (scene as unknown as { lockedLayers: string[] }).lockedLayers = [];
    expect(props.onErase).not.toHaveBeenCalled();
  });

  it("erases the mark under the pointer if the person may erase it and its layer is open", () => {
    props.floor = floor([
      { id: "d1", kind: "line", layer: "objects", points: [0, 0, 100, 0] },
      { id: "d2", kind: "line", layer: "gm", points: [0, 50, 100, 50] },
    ]);
    props.draw = { kind: "erase", color: "#000000", text: "", layer: "objects" };
    controller.pointerDown(event(50, 3));
    expect(props.onErase).toHaveBeenCalledWith("d1");

    props.canErase = (drawing) => drawing.id !== "d1";
    (props.onErase as ReturnType<typeof vi.fn>).mockClear();
    controller.pointerDown(event(50, 3));
    expect(props.onErase).not.toHaveBeenCalled();
  });
});

describe("dragging a light", () => {
  const start = (marker: Graphics) => ({ index: 2, marker, x: 100, y: 100, moved: false, startX: 100, startY: 100, dx: 5, dy: -5 });

  it("treats a few pixels of jitter as a click, not a drag", () => {
    const marker = new Graphics();
    controller.startLightDrag(start(marker));
    controller.pointerMove(event(102, 102));
    controller.pointerUp(event(102, 102));
    expect(props.onMoveLight).not.toHaveBeenCalled();
  });

  it("moves the marker with the pointer, keeping the grab offset, and saves the drop", () => {
    const marker = new Graphics();
    controller.startLightDrag(start(marker));
    controller.pointerMove(event(200, 150));
    expect([marker.x, marker.y]).toEqual([205, 145]);
    controller.pointerUp(event(200, 150));
    expect(props.onMoveLight).toHaveBeenCalledWith(2, 205, 145);
    // The drag is over: later moves do nothing.
    controller.pointerMove(event(500, 500));
    expect([marker.x, marker.y]).toEqual([205, 145]);
  });

  it("follows the replacement marker when the map data was redrawn under the pointer", () => {
    const old = new Graphics();
    const fresh = new Graphics();
    replacement.mockReturnValue(fresh);
    controller.startLightDrag(start(old));
    old.destroy();
    controller.pointerMove(event(200, 150));
    expect(replacement).toHaveBeenCalledWith(2);
    expect([fresh.x, fresh.y]).toEqual([205, 145]);
  });
});
