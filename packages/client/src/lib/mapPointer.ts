import type { DrawingDto, FloorDto, SceneDto, TokenDto } from "@openvtt/shared";
import type { Container, FederatedPointerEvent, Graphics, Text } from "pixi.js";
import type { DrawSettings } from "../tableStore";
import { drawingAt } from "./drawings";
import { extendSketch, isDeliberateStroke, rulerReadout, tokensInBox } from "./mapInteraction";
import { renderShape } from "./mapShapes";
import { conePoints, type DiagonalRule, type Point, type RulerShape } from "./ruler";

/** What the pointer handlers read from the map's props, always the latest ones. */
export interface PointerProps {
  tool: string;
  scene: SceneDto | null;
  floor: FloorDto | null;
  tokens: TokenDto[];
  draw: DrawSettings;
  rulerShape: RulerShape;
  diagonalRule: DiagonalRule;
  /** Formats the ruler label; receives distance in grid cells. */
  formatDistance: (cells: number) => string;
  canErase: (drawing: DrawingDto) => boolean;
  onPing: (x: number, y: number, focus: boolean) => void;
  onSelect: (tokenId: string | null) => void;
  onSelectMany: (tokenIds: string[]) => void;
  onAddLight: (x: number, y: number) => void;
  onMoveLight: (index: number, x: number, y: number) => void;
  onEffectPoint: (x: number, y: number) => void;
  onDraw: (drawing: Pick<DrawingDto, "kind" | "layer" | "points" | "color" | "text">) => void;
  onErase: (drawingId: string) => void;
}

/** The light marker being dragged with the light tool; its map data is rebuilt after the drop saves. */
export interface LightDrag {
  index: number;
  marker: Graphics;
  x: number;
  y: number;
  moved: boolean;
  /** Screen position of the press and the light's offset from the pressed map point. */
  startX: number;
  startY: number;
  dx: number;
  dy: number;
}

/** A few pixels of jitter during a click are not a drag. */
const LIGHT_DRAG_THRESHOLD_PX = 4;
const RULER_COLOR = 0xffc914;
const SELECTION_BOX_COLOR = 0x66d9ff;
/** How close, in screen pixels, the eraser must be to a mark to pick it. */
const ERASE_REACH_PX = 10;

/**
 * What a press, drag and release on the empty map do for the active tool: pan, box-select, measure, draw, place or
 * drag a light, ping. It owns the state of the gesture in progress and reads everything else from `getProps`.
 * `replacementMarker` finds the marker that took the place of a light marker redrawn while it was being dragged.
 */
export class MapPointerController {
  private panning: Point | null = null;
  private rulerStart: Point | null = null;
  /** Shift+drag on the background draws a box; the tokens whose centre falls inside get selected. */
  private boxStart: Point | null = null;
  /** Points of the mark being drawn; shapes keep only the start and the latest point. */
  private sketch: number[] | null = null;
  private lightDrag: LightDrag | null = null;

  constructor(
    private stage: Container,
    private world: Container,
    private ruler: Graphics,
    private label: Text,
    private getProps: () => PointerProps,
    private replacementMarker: (lightIndex: number) => Graphics | undefined,
  ) {}

  private toWorld(e: FederatedPointerEvent): Point {
    return this.world.toLocal(e.global);
  }

  /** A light marker was pressed with the light tool: the moves that follow drag it. */
  startLightDrag(drag: LightDrag) {
    this.lightDrag = drag;
  }

  /** Two fingers went down: whatever one finger was doing stands still. */
  cancelGestures() {
    this.panning = null;
    this.rulerStart = null;
    this.sketch = null;
  }

  pointerDown(e: FederatedPointerEvent) {
    const props = this.getProps();
    if (e.altKey && e.button === 0) {
      const point = this.toWorld(e);
      return props.onPing(point.x, point.y, e.shiftKey);
    }
    const tool = props.tool;
    const onBackground = e.target === this.stage;
    if (tool === "select" && e.button === 0 && e.shiftKey && onBackground) {
      this.boxStart = this.toWorld(e);
      return;
    }
    if (e.button === 1 || e.button === 2 || (tool === "select" && onBackground)) {
      this.panning = { x: e.global.x - this.world.x, y: e.global.y - this.world.y };
      if (tool === "select" && e.button === 0) props.onSelect(null);
    } else if (tool === "light" && e.button === 0 && onBackground) {
      const point = this.toWorld(e);
      props.onAddLight(point.x, point.y);
    } else if (tool === "effect" && e.button === 0) {
      const point = this.toWorld(e);
      props.onEffectPoint(point.x, point.y);
    } else if (tool === "ruler" && e.button === 0) {
      this.rulerStart = this.toWorld(e);
    } else if (tool === "draw" && e.button === 0) {
      this.startDrawing(this.toWorld(e), props);
    }
  }

  private startDrawing(point: Point, props: PointerProps) {
    const { draw, scene, floor } = props;
    if (!scene || !floor || (draw.kind !== "erase" && scene.lockedLayers.includes(draw.kind === "note" ? "gm" : draw.layer))) return;
    if (draw.kind === "erase") {
      const erasable = floor.drawings.filter((d) => props.canErase(d) && !scene.lockedLayers.includes(d.layer));
      const target = drawingAt(erasable, point, ERASE_REACH_PX / this.world.scale.x);
      if (target) props.onErase(target.id);
    } else if (draw.kind === "text" || draw.kind === "note") {
      if (draw.text.trim())
        props.onDraw({ kind: draw.kind, layer: draw.layer, points: [point.x, point.y], color: draw.color, text: draw.text });
    } else this.sketch = [point.x, point.y];
  }

  pointerMove(e: FederatedPointerEvent) {
    const { world, ruler } = this;
    if (this.lightDrag) return this.moveLight(e, this.lightDrag);
    if (this.sketch) {
      const point = this.toWorld(e);
      const { draw, scene } = this.getProps();
      this.sketch = extendSketch(this.sketch, draw.kind, point, world.scale.x);
      ruler.clear();
      if (draw.kind !== "erase") renderShape(ruler, { kind: draw.kind, points: this.sketch, color: draw.color }, scene?.gridSize ?? 70);
      return;
    }
    if (this.panning) {
      world.position.set(e.global.x - this.panning.x, e.global.y - this.panning.y);
    } else if (this.boxStart) {
      const end = this.toWorld(e);
      const start = this.boxStart;
      ruler
        .clear()
        .rect(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x), Math.abs(end.y - start.y))
        .fill({ color: SELECTION_BOX_COLOR, alpha: 0.15 })
        .stroke({ width: 2 / world.scale.x, color: SELECTION_BOX_COLOR });
    } else if (this.rulerStart) {
      this.measure(this.rulerStart, this.toWorld(e));
    }
  }

  private moveLight(e: FederatedPointerEvent, drag: LightDrag) {
    if (!drag.moved && Math.hypot(e.global.x - drag.startX, e.global.y - drag.startY) < LIGHT_DRAG_THRESHOLD_PX) return;
    const point = this.toWorld(e);
    drag.x = point.x + drag.dx;
    drag.y = point.y + drag.dy;
    drag.moved = true;
    // Selecting the light redraws the map data under the pointer; follow the marker that replaced the dragged one.
    if (drag.marker.destroyed) drag.marker = this.replacementMarker(drag.index) ?? drag.marker;
    if (!drag.marker.destroyed) drag.marker.position.set(drag.x, drag.y);
  }

  /** Draws the ruler's shape from `start` to `end` and writes its measurement next to the pointer. */
  private measure(start: Point, end: Point) {
    const { world, ruler, label } = this;
    const { scene, rulerShape, diagonalRule, formatDistance } = this.getProps();
    const zoom = world.scale.x;
    const line = { width: 3 / zoom, color: RULER_COLOR };
    const area = { color: RULER_COLOR, alpha: 0.18 };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    ruler.clear();
    if (rulerShape === "circle") {
      ruler.circle(start.x, start.y, Math.hypot(dx, dy)).fill(area).stroke(line);
      ruler.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke(line);
    } else if (rulerShape === "cone") {
      ruler
        .poly(conePoints(start, end).flatMap((p) => [p.x, p.y]))
        .fill(area)
        .stroke(line);
    } else if (rulerShape === "rectangle") {
      ruler.rect(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(dx), Math.abs(dy)).fill(area).stroke(line);
    } else {
      ruler.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke(line);
    }
    label.text = rulerReadout(rulerShape, start, end, scene, diagonalRule, formatDistance);
    label.scale.set(1 / zoom);
    label.position.set(end.x + 8 / zoom, end.y + 8 / zoom);
  }

  pointerUp(e: FederatedPointerEvent) {
    const props = this.getProps();
    this.panning = null;
    if (this.lightDrag) {
      const dropped = this.lightDrag;
      this.lightDrag = null;
      if (dropped.moved) props.onMoveLight(dropped.index, dropped.x, dropped.y);
    }
    if (this.sketch) {
      const points = this.sketch;
      this.sketch = null;
      this.ruler.clear();
      const { draw } = props;
      if (isDeliberateStroke(points, this.world.scale.x) && draw.kind !== "erase")
        props.onDraw({ kind: draw.kind, layer: draw.layer, points, color: draw.color, text: "" });
    }
    if (this.boxStart) {
      const corner = this.boxStart;
      this.boxStart = null;
      this.ruler.clear();
      if (props.scene) props.onSelectMany(tokensInBox(props.tokens, props.scene, corner, this.toWorld(e)));
    }
    // The ruler stays visible until the next measurement or tool change.
    this.rulerStart = null;
  }
}
