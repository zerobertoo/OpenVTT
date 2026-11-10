import type { DrawingDto, EffectDto, FloorDto, SceneDto, TokenDto, VisionDto } from "@openvtt/shared";
import { Application, Container, CullerPlugin, extensions, Graphics, Sprite, Text, Texture, type Ticker } from "pixi.js";
// Pixi builds some drawing code at run time, which the server's Content-Security-Policy forbids; this swaps in the fixed versions.
import "pixi.js/unsafe-eval";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { COMPENDIUM_DRAG_TYPE } from "./components/tokens/Compendium";
import { Button } from "./components/ui/button";
import { Icon } from "./icons";
import { applyTwoFingerGesture, type TwoFingerState, twoFingerState } from "./lib/gestures";
import { paintShade, planShade, shadeSize } from "./lib/lighting";
import { fitView, MAX_ZOOM, minZoomFor, type View, viewCenteredOn, ZOOM_STEP, zoomAround } from "./lib/mapCamera";
import { buildMapData } from "./lib/mapData";
import { tokenChangeEffects } from "./lib/mapEffects";
import { drawGrid, gridKey } from "./lib/mapGrid";
import { assetIdsInUse, draggedCenter, dropToken, tokenCenter, zoomAtCursor } from "./lib/mapInteraction";
import { MapPointerController } from "./lib/mapPointer";
import { drawingView } from "./lib/mapShapes";
import { loadTexture } from "./lib/mapTextures";
import { drawTokenView } from "./lib/mapToken";
import {
  disposeVideoBackground,
  setVideoHidden,
  startVideoBackground,
  toggleVideoPlayback,
  type VideoBackground,
  type VideoUi,
} from "./lib/mapVideo";
import { MINIMAP_MAX_SIDE, minimapSize, sceneAt, visibleArea } from "./lib/minimap";
import type { DiagonalRule, RulerShape } from "./lib/ruler";
import type { Move } from "./lib/tableActions";
import { type DrawSettings, type MapLayers, useTableUi } from "./tableStore";

/** The drawing of effects is a chunk of its own; it starts downloading with the map, before the first effect needs it. */
const effectScenes = () => import("./lib/effectScenes");

/** Plays an effect once its drawing code is there, unless the map went away meanwhile. */
function playEffect(app: Application, world: Container, effect: EffectDto, grid: number, reduced: boolean) {
  void effectScenes().then((scenes) => {
    if (!world.destroyed) scenes.playEffect(app, world, effect, grid, reduced);
  });
}

/** How long after it was fired an effect still plays, and how many token changes play at once. */
const EFFECT_FRESH_MS = 3000;
const MAX_TOKEN_EFFECTS = 12;

export type MapTool = "select" | "ruler" | "draw" | "light" | "effect";

interface Props {
  scene: SceneDto | null;
  /** The floor of the scene being looked at: its background, walls, lights and drawings are what gets drawn. */
  floor: FloorDto | null;
  /** The floor below, drawn faintly over the background for the game master; null when off. */
  ghostFloor: FloorDto | null;
  tokens: TokenDto[];
  tool: MapTool;
  selectedTokenIds: string[];
  canControl: (token: TokenDto) => boolean;
  onSelect: (tokenId: string | null) => void;
  /** Shift+click: adds or removes one token from the selection. */
  onToggle: (tokenId: string) => void;
  /** Shift+drag box: replaces the selection. */
  onSelectMany: (tokenIds: string[]) => void;
  /** Called while dragging (throttled) and once on drop with the snapped position. */
  onMove: (tokenId: string, x: number, y: number) => void;
  /** What this player can see; null shows the whole map (the game master, or a scene without vision). */
  vision: VisionDto | null;
  /** Which overlays to draw (walls, doors and lights only exist for the game master). */
  layers: MapLayers;
  onToggleDoor: (wallId: string, open: boolean) => void;
  /** Alt+click marks a spot for everybody; Alt+Shift+click (game master) also asks them to look at it. */
  onPing: (x: number, y: number, focus: boolean) => void;
  /** A click on the map while the effect tool is active (scene pixels). */
  onEffectPoint: (x: number, y: number) => void;
  /** Formats the ruler label; receives distance in grid cells. */
  formatDistance: (cells: number) => string;
  rulerShape: RulerShape;
  diagonalRule: DiagonalRule;
  draw: DrawSettings;
  onDraw: (drawing: Pick<DrawingDto, "kind" | "layer" | "points" | "color" | "text">) => void;
  /** Only called for drawings `canErase` accepts. */
  onErase: (drawingId: string) => void;
  canErase: (drawing: DrawingDto) => boolean;
  /** After a drag ends, where each dragged token started and landed. */
  onMoved: (moves: Move[]) => void;
  /** A compendium entry dropped on the map, at that map point. */
  onDropEntry: (entryId: string, x: number, y: number) => void;
  /** Light tool: the position in the floor's light list of the light being edited. */
  selectedLight: number | null;
  onSelectLight: (index: number | null) => void;
  /** Light tool: a click on empty map places a light there. */
  onAddLight: (x: number, y: number) => void;
  /** Light tool: a light was dragged and dropped. */
  onMoveLight: (index: number, x: number, y: number) => void;
}

/** The zoom and position of the map container. */
const viewOf = (world: Container): View => ({ scale: world.scale.x, x: world.x, y: world.y });

/** Puts the map container at the given zoom and position. */
function setView(world: Container, view: View) {
  world.scale.set(view.scale);
  world.position.set(view.x, view.y);
}

/** Shows the whole map centered in the view, never enlarged past its real size. */
function fitToScreen(world: Container, screen: { width: number; height: number }, scene: { width: number; height: number }) {
  setView(world, fitView(screen, scene));
}
const DRAG_SEND_INTERVAL_MS = 80;
// Objects outside the view are skipped when drawing (only those marked `cullable`).
extensions.add(CullerPlugin);

/** Eases a view's scale from `from` back to 1 with a small overshoot (used when a token appears or lands). */
function popScale(ticker: Ticker, view: Container, from: number, durationMs: number) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const started = performance.now();
  view.scale.set(from);
  const step = () => {
    if (view.destroyed) return void ticker.remove(step);
    const t = Math.min(1, (performance.now() - started) / durationMs);
    const overshoot = 1.70158;
    const eased = 1 + (overshoot + 1) * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
    view.scale.set(from + (1 - from) * eased);
    if (t >= 1) {
      view.scale.set(1);
      ticker.remove(step);
    }
  };
  ticker.add(step);
}

/** Mutable bag read by Pixi event handlers so they always see the latest props. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export function MapView(props: Props) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const latest = useLatest(props);
  const syncAll = useRef<() => void>(() => {});
  const engine = useRef<{
    app: Application;
    world: Container;
    background: Container;
    grid: Graphics;
    mapData: Container;
    drawingLayers: Record<DrawingDto["layer"], Container>;
    /** Darkness, fog and light pools in one picture the size of the map (see `lib/lighting`). */
    shade: Sprite;
    shadeCanvas: HTMLCanvasElement;
    /** What the shade picture shows now, so syncs that change nothing about it skip the repaint. */
    shownShade: { scene: SceneDto; floor: FloorDto; vision: VisionDto | null; preview: boolean } | null;
    tokenLayer: Container;
    ruler: Graphics;
    rulerLabel: Text;
    tokenViews: Map<string, Container>;
    fitted: string | null;
    video: VideoBackground | null;
    /** What is drawn now, so syncs caused by token moves skip rebuilding them. */
    shownDrawings: FloorDto["drawings"] | null;
    shownGrid: string;
  } | null>(null);
  const minimap = useRef<HTMLCanvasElement>(null);
  const minimapOpen = useTableUi((ui) => ui.minimapOpen && ui.view !== "tv");
  const [videoUi, setVideoUi] = useState<VideoUi>({ status: "none", playing: false });
  /** True when the renderer could not start (no WebGL, or the browser blocked it). */
  const [renderFailed, setRenderFailed] = useState(false);

  // One Pixi application for the lifetime of the component.
  useEffect(() => {
    const element = host.current!;
    const app = new Application();
    let destroyed = false;
    let failed = false;
    // True while two fingers are down; token drags, pans and the ruler stand still meanwhile.
    let pinching = false;
    const ready = app
      .init({ resizeTo: element, background: 0x1b1d22, antialias: true, resolution: window.devicePixelRatio, autoDensity: true })
      .then(() => {
        if (destroyed) return;
        element.appendChild(app.canvas);
        const world = new Container();
        const background = new Container();
        const grid = new Graphics();
        const mapData = new Container();
        const shade = new Sprite();
        shade.eventMode = "none";
        shade.visible = false;
        const shadeCanvas = document.createElement("canvas");
        const tokenLayer = new Container();
        // Background marks sit under the grid, object marks under the tokens, the game master's above them.
        const drawingLayers = { background: new Container(), objects: new Container(), gm: new Container() };
        for (const layer of Object.values(drawingLayers)) layer.eventMode = "none";
        const ruler = new Graphics();
        const rulerLabel = new Text({ text: "", style: { fill: 0xffffff, fontSize: 16, stroke: { color: 0x000000, width: 4 } } });
        world.addChild(
          background,
          drawingLayers.background,
          grid,
          mapData,
          drawingLayers.objects,
          tokenLayer,
          drawingLayers.gm,
          shade,
          ruler,
          rulerLabel,
        );
        app.stage.addChild(world);
        app.stage.eventMode = "static";
        app.stage.hitArea = app.screen;
        engine.current = {
          app,
          world,
          background,
          grid,
          mapData,
          drawingLayers,
          shade,
          shadeCanvas,
          shownShade: null,
          tokenLayer,
          ruler,
          rulerLabel,
          tokenViews: new Map(),
          fitted: null,
          video: null,
          shownDrawings: null,
          shownGrid: "",
        };
        bindInteractions(app, world, ruler, rulerLabel);
        void effectScenes();
        useTableUi.setState({ mapCenter: () => world.toLocal({ x: app.screen.width / 2, y: app.screen.height / 2 }) });
        // The overview only needs to follow the view a few times a second.
        let lastMinimapDraw = 0;
        app.ticker.add(() => {
          if (performance.now() - lastMinimapDraw < 100) return;
          lastMinimapDraw = performance.now();
          drawMinimap();
        });
        syncAll.current();
      })
      .catch((error: unknown) => {
        // Without a renderer the start failed (no WebGL): there is nothing to draw on or destroy later.
        // Any other error came from setting up the scene and keeps surfacing as before.
        if (app.renderer) throw error;
        failed = true;
        if (!destroyed) setRenderFailed(true);
      });

    // What a press, drag and release on the empty map do; set once the map engine is ready.
    let pointer: MapPointerController | null = null;

    function bindInteractions(app: Application, world: Container, ruler: Graphics, label: Text) {
      const controller = new MapPointerController(app.stage, world, ruler, label, props_, (index) => {
        const marker = engine.current?.mapData.children[0]?.children[index];
        return marker instanceof Graphics ? marker : undefined;
      });
      pointer = controller;
      app.stage.on("pointerdown", (e) => controller.pointerDown(e));
      app.stage.on("pointermove", (e) => controller.pointerMove(e));
      app.stage.on("pointerup", (e) => controller.pointerUp(e));
      app.stage.on("pointerupoutside", (e) => controller.pointerUp(e));
      // Two fingers pinch-zoom and pan. They run in the capture phase so Pixi never sees them as a drag or a ruler.
      const touches = new Map<number, { x: number; y: number }>();
      let twoFingers: TwoFingerState | null = null;
      const touchPoint = (e: PointerEvent) => {
        const rect = element.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      };
      const currentTwoFingers = () => {
        const [a, b] = [...touches.values()];
        return a && b ? twoFingerState(a, b) : null;
      };
      element.addEventListener(
        "pointerdown",
        (e) => {
          if (e.pointerType !== "touch") return;
          touches.set(e.pointerId, touchPoint(e));
          if (touches.size === 2) {
            pinching = true;
            controller.cancelGestures();
            twoFingers = currentTwoFingers();
          }
          if (pinching) e.stopPropagation();
        },
        true,
      );
      element.addEventListener(
        "pointermove",
        (e) => {
          if (e.pointerType !== "touch" || !touches.has(e.pointerId)) return;
          touches.set(e.pointerId, touchPoint(e));
          if (!pinching) return;
          e.stopPropagation();
          const next = currentTwoFingers();
          if (!next || !twoFingers) return;
          const view = applyTwoFingerGesture(viewOf(world), twoFingers, next, minZoomFor(app.screen, latest.current.scene), MAX_ZOOM);
          setView(world, view);
          twoFingers = next;
        },
        true,
      );
      const releaseTouch = (e: PointerEvent) => {
        if (e.pointerType !== "touch") return;
        touches.delete(e.pointerId);
        // A finger left behind does not start a pan or a drag; the next touch starts fresh.
        if (touches.size < 2) {
          pinching = false;
          twoFingers = null;
        }
      };
      element.addEventListener("pointerup", releaseTouch, true);
      element.addEventListener("pointercancel", releaseTouch, true);
      element.addEventListener("contextmenu", (e) => e.preventDefault());
      element.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const rect = element.getBoundingClientRect();
          const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          const view = zoomAtCursor(viewOf(world), cursor, e.deltaY, minZoomFor(app.screen, latest.current.scene), MAX_ZOOM);
          setView(world, view);
        },
        { passive: false },
      );
    }

    const props_ = () => latest.current;
    const assetsInUse = () => {
      const { floor, ghostFloor, tokens } = props_();
      return assetIdsInUse(floor, ghostFloor, tokens);
    };

    /** Scene outline, tokens as dots and the part of the map on screen, on the overview canvas. */
    function drawMinimap() {
      const canvas = minimap.current;
      const e = engine.current;
      const scene = props_().scene;
      if (!canvas || !e || !scene) return;
      const size = minimapSize(scene);
      // Twice the CSS size keeps the dots crisp on dense screens.
      if (canvas.width !== size.width * 2) {
        canvas.width = size.width * 2;
        canvas.height = size.height * 2;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      const factor = canvas.width / scene.width;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(20, 22, 26, 0.85)";
      context.fillRect(0, 0, canvas.width, canvas.height);
      for (const token of props_().tokens) {
        if (token.sceneId !== scene.id) continue;
        const span = token.size * scene.gridSize;
        context.fillStyle = token.color;
        context.beginPath();
        context.arc((token.x + span / 2) * factor, (token.y + span / 2) * factor, Math.max(2.5, (span / 2) * factor), 0, Math.PI * 2);
        context.fill();
      }
      const view = visibleArea(viewOf(e.world), e.app.screen);
      context.strokeStyle = "#ffffff";
      context.lineWidth = 2;
      context.strokeRect(view.x * factor, view.y * factor, view.width * factor, view.height * factor);
    }
    syncAll.current = () => {
      void syncScene();
      syncTokens();
      syncShade();
      syncDrawings();
    };

    function syncDrawings() {
      const e = engine.current;
      if (!e) return;
      const { scene, floor, layers } = props_();
      e.drawingLayers.gm.visible = layers.gmDrawings;
      e.drawingLayers.background.visible = e.background.visible = layers.background;
      e.drawingLayers.objects.visible = layers.objects;
      e.tokenLayer.visible = layers.tokens;
      const drawings = floor?.drawings ?? null;
      if (drawings === e.shownDrawings) return;
      e.shownDrawings = drawings;
      for (const layer of Object.values(e.drawingLayers)) for (const child of layer.removeChildren()) child.destroy({ children: true });
      if (!scene || !floor) return;
      for (const drawing of floor.drawings) {
        const view = drawingView(drawing, scene.gridSize);
        view.cullable = true;
        e.drawingLayers[drawing.layer].addChild(view);
      }
    }

    // Each run replaces the one before; a run that wakes up after a newer one started must not touch the background.
    let latestRun = 0;
    let measuredFloorId: string | null = null;
    let shownMap: {
      scene: SceneDto | null;
      floor: FloorDto | null;
      ghost: FloorDto | null;
      layers: MapLayers;
      lightsEdited: number | null;
    } | null = null;
    async function syncScene() {
      const e = engine.current;
      const { scene, floor, ghostFloor: ghost, layers, tool, selectedLight } = props_();
      if (!e) return;
      // Rebuilding means every wall and door again, so only what the map is drawn from may trigger it, not token moves.
      const lightsEdited = tool === "light" ? (selectedLight ?? -1) : null;
      if (
        shownMap?.scene === scene &&
        shownMap.floor === floor &&
        shownMap.ghost === ghost &&
        shownMap.layers === layers &&
        shownMap.lightsEdited === lightsEdited
      )
        return;
      shownMap = { scene, floor, ghost, layers, lightsEdited };
      const run = ++latestRun;
      for (const child of e.background.removeChildren()) child.destroy();
      for (const child of e.mapData.removeChildren()) child.destroy({ children: true });
      // A measurement belongs to the floor it was taken on; other updates must leave it in place.
      if ((floor?.id ?? null) !== measuredFloorId) {
        measuredFloorId = floor?.id ?? null;
        e.ruler.clear();
        e.rulerLabel.text = "";
      }
      if (!scene || !floor) {
        e.grid.clear();
        e.shownGrid = "";
        return void disposeVideo(e);
      }
      const sceneId = scene.id;
      if (floor.assetId && floor.assetKind === "video") {
        if (e.video?.assetId !== floor.assetId) {
          disposeVideo(e);
          const assetId = floor.assetId;
          e.video = startVideoBackground(assetId, (background) => e.video === background, setVideoUi);
        }
        const loaded = await e.video!.ready;
        // Another floor, scene or setting was shown while the video loaded; its own sync draws the map.
        if (run !== latestRun) return;
        for (const child of e.background.removeChildren()) child.destroy();
        if (loaded) {
          const sprite = new Sprite(loaded.texture);
          sprite.width = scene.width;
          sprite.height = scene.height;
          e.background.addChild(sprite);
        } else {
          // Without the video the map is still usable: plain background plus grid and tokens.
          e.background.addChild(new Graphics().rect(0, 0, scene.width, scene.height).fill(0x2a2d34));
        }
      } else if (floor.assetId) {
        disposeVideo(e);
        const texture = await loadTexture(floor.assetId, assetsInUse).catch(() => null);
        if (run !== latestRun) return;
        if (texture) {
          const sprite = new Sprite(texture);
          sprite.width = scene.width;
          sprite.height = scene.height;
          e.background.addChild(sprite);
        } else {
          // The picture did not load: keep the grid, tokens and view working over a plain background.
          e.background.addChild(new Graphics().rect(0, 0, scene.width, scene.height).fill(0x2a2d34));
        }
      } else {
        disposeVideo(e);
        e.background.addChild(new Graphics().rect(0, 0, scene.width, scene.height).fill(0x2a2d34));
      }
      const below = props_().ghostFloor;
      if (below?.assetId) {
        const texture = await loadTexture(below.assetId, assetsInUse, below.assetKind === "video").catch(() => null);
        if (run !== latestRun) return;
        if (texture) {
          const ghost = new Sprite(texture);
          ghost.width = scene.width;
          ghost.height = scene.height;
          ghost.alpha = 0.3;
          e.background.addChild(ghost);
        }
      }
      const key = gridKey(scene);
      if (key !== e.shownGrid) {
        e.shownGrid = key;
        drawGrid(e.grid, scene);
      }
      e.grid.visible = props_().layers.grid;
      drawMapData(e, scene, floor, props_().layers);
      if (e.fitted !== sceneId) {
        // Fit the whole map in view the first time a scene is shown.
        fitToScreen(e.world, e.app.screen, scene);
        e.fitted = sceneId;
      }
    }

    /** Draws the floor's lights, walls and doors; pressing a light marker while editing starts dragging it. */
    function drawMapData(e: NonNullable<typeof engine.current>, scene: SceneDto, floor: FloorDto, layers: MapLayers) {
      const editing = props_().tool === "light" ? { selectedLight: props_().selectedLight } : null;
      const { lights, walls, doors } = buildMapData(scene, floor, layers, editing, {
        canToggleDoor: () => props_().tool === "select",
        onLightGrab: (index, marker, event) => {
          const light = floor.lights[index];
          if (!light) return;
          if (props_().selectedLight !== index) props_().onSelectLight(index);
          // The light keeps its distance from the grab point, so a click never nudges it.
          const grab = e.world.toLocal(event.global);
          pointer?.startLightDrag({
            index,
            marker,
            x: light.x,
            y: light.y,
            moved: false,
            startX: event.global.x,
            startY: event.global.y,
            dx: light.x - grab.x,
            dy: light.y - grab.y,
          });
        },
        onDoorToggle: (wallId, open) => props_().onToggleDoor(wallId, open),
      });
      e.mapData.addChild(lights, walls, doors);
    }

    /**
     * Darkens what a player cannot see and what no light reaches. A player's polygons and light pools come from the
     * server, which never sends walls; the game master's pools are computed here from the floor's own walls.
     */
    function syncShade() {
      const e = engine.current;
      const { scene, floor, vision, layers } = props_();
      if (!e) return;
      if (!scene || !floor) {
        e.shade.visible = false;
        e.shownShade = null;
        return;
      }
      const shown = e.shownShade;
      if (shown && shown.scene === scene && shown.floor === floor && shown.vision === vision && shown.preview === layers.lightRange) return;
      e.shownShade = { scene, floor, vision, preview: layers.lightRange };
      const plan = planShade(scene, floor, vision, layers.lightRange);
      e.shade.visible = plan !== null;
      if (!plan) return;
      const size = shadeSize(scene.width, scene.height);
      // A new canvas (and texture) only when the map size changes; otherwise the same texture is refreshed from its canvas.
      const resized = e.shadeCanvas.width !== size.width || e.shadeCanvas.height !== size.height;
      if (resized) {
        e.shadeCanvas = document.createElement("canvas");
        e.shadeCanvas.width = size.width;
        e.shadeCanvas.height = size.height;
      }
      const context = e.shadeCanvas.getContext("2d");
      if (!context) return;
      paintShade(context, plan, scene.width, scene.height, size.scale);
      if (resized || e.shade.texture === Texture.EMPTY) {
        const old = e.shade.texture;
        e.shade.texture = Texture.from(e.shadeCanvas);
        if (old !== Texture.EMPTY) old.destroy(true);
      } else e.shade.texture.source.update();
      e.shade.width = scene.width;
      e.shade.height = scene.height;
    }

    function disposeVideo(e: NonNullable<typeof engine.current>) {
      const background = e.video;
      if (!background) return;
      e.video = null;
      disposeVideoBackground(background, setVideoUi);
    }

    const shownTokens = new WeakMap<Container, { token: TokenDto; gridSize: number; selected: boolean }>();
    function syncTokens() {
      const e = engine.current;
      if (!e) return;
      const { tokens, scene, selectedTokenIds } = props_();
      const visible = tokens.filter((t) => t.sceneId === scene?.id);
      const keep = new Set(visible.map((t) => t.id));
      for (const [id, view] of e.tokenViews)
        if (!keep.has(id)) {
          view.destroy({ children: true });
          e.tokenViews.delete(id);
        }
      for (const token of visible) {
        let view = e.tokenViews.get(token.id);
        if (!view) {
          view = createTokenView(token);
          e.tokenViews.set(token.id, view);
          e.tokenLayer.addChild(view);
        }
        const gridSize = scene!.gridSize;
        const selected = selectedTokenIds.includes(token.id);
        const shown = shownTokens.get(view);
        if (shown?.token === token && shown.gridSize === gridSize && shown.selected === selected) continue;
        shownTokens.set(view, { token, gridSize, selected });
        drawToken(view, token, gridSize, selected);
      }
    }

    function createTokenView(token: TokenDto): Container {
      const view = new Container();
      view.eventMode = "static";
      view.cursor = "pointer";
      view.cullable = true;
      // Dragging a selected token drags the whole selection (the ones this person may move) by the same distance.
      let drag: { startX: number; startY: number; lastSent: number; members: { token: TokenDto; view: Container }[] } | null = null;
      view.on("pointerdown", (e) => {
        // Alt+click pings, even on top of a token: let it reach the stage.
        if (props_().tool !== "select" || e.button !== 0 || e.altKey) return;
        e.stopPropagation();
        // Shift+click adds the token to the selection or takes it out; it never starts a drag.
        if (e.shiftKey) return props_().onToggle(token.id);
        const selected = props_().selectedTokenIds;
        const ids = selected.includes(token.id) ? selected : [token.id];
        if (ids !== selected) props_().onSelect(token.id);
        const current = currentToken(token.id);
        if (!current || !props_().canControl(current) || props_().scene?.lockedLayers.includes("tokens")) return;
        const members = ids.flatMap((id) => {
          const member = currentToken(id);
          const memberView = engine.current!.tokenViews.get(id);
          return member && memberView && props_().canControl(member) ? [{ token: member, view: memberView }] : [];
        });
        const local = engine.current!.world.toLocal(e.global);
        drag = { startX: local.x, startY: local.y, lastSent: 0, members };
      });
      view.on("globalpointermove", (e) => {
        if (!drag) return;
        const scene = props_().scene;
        if (pinching) {
          // Nothing else redraws an unchanged token, so an abandoned drag has to put it back itself.
          for (const member of drag.members) member.view.position.copyFrom(tokenCenter(member.token, scene?.gridSize ?? 0));
          drag = null;
          return;
        }
        if (!scene) return;
        const local = engine.current!.world.toLocal(e.global);
        const delta = { x: local.x - drag.startX, y: local.y - drag.startY };
        const send = performance.now() - drag.lastSent > DRAG_SEND_INTERVAL_MS;
        if (send) drag.lastSent = performance.now();
        for (const member of drag.members) {
          member.view.position.copyFrom(draggedCenter(member.token, delta, scene.gridSize));
          if (send) props_().onMove(member.token.id, member.token.x + delta.x, member.token.y + delta.y);
        }
      });
      const drop = () => {
        const scene = props_().scene;
        if (!drag || !scene) {
          drag = null;
          return;
        }
        const { members } = drag;
        drag = null;
        const moves: Move[] = [];
        for (const member of members) {
          const { corner, move } = dropToken(scene, member.token, member.view.position);
          member.view.position.copyFrom(tokenCenter({ ...member.token, ...corner }, scene.gridSize));
          props_().onMove(member.token.id, corner.x, corner.y);
          if (move) moves.push(move);
          popScale(app.ticker, member.view, 1.15, 240);
        }
        props_().onMoved(moves);
      };
      view.on("pointerup", drop);
      view.on("pointerupoutside", drop);
      popScale(app.ticker, view, 0, 360);
      return view;
    }

    const currentToken = (id: string) => props_().tokens.find((t) => t.id === id);

    const drawToken = (view: Container, token: TokenDto, gridSize: number, selected: boolean) =>
      drawTokenView(view, token, gridSize, selected, (assetId) => loadTexture(assetId, assetsInUse).catch(() => null));

    return () => {
      destroyed = true;
      void ready.then(() => {
        if (engine.current) disposeVideo(engine.current);
        engine.current = null;
        if (!failed) app.destroy(true, { children: true });
      });
    };
    // The application is created once; prop changes are pushed through `syncAll` below.
  }, []);

  useEffect(() => {
    syncAll.current();
  }, [
    props.scene,
    props.floor,
    props.ghostFloor,
    props.tokens,
    props.selectedTokenIds,
    props.layers,
    props.vision,
    props.tool,
    props.selectedLight,
  ]);

  // Zoom keys arrive through the table store; zooming keeps the middle of the view where it is.
  const viewCommand = useTableUi((ui) => ui.viewCommand);
  useEffect(() => {
    const e = engine.current;
    if (!e || !viewCommand) return;
    if (viewCommand.kind === "fit") {
      if (latest.current.scene) fitToScreen(e.world, e.app.screen, latest.current.scene);
      return;
    }
    const center = { x: e.app.screen.width / 2, y: e.app.screen.height / 2 };
    if (viewCommand.kind === "center") {
      // The selected token if it is one of mine, otherwise the first of mine on this map.
      const { scene, tokens, canControl, selectedTokenIds } = latest.current;
      const mine = tokens.filter((tk) => tk.sceneId === scene?.id && canControl(tk));
      const target = mine.find((tk) => selectedTokenIds.includes(tk.id)) ?? mine[0];
      if (!scene || !target) return;
      e.world.position.copyFrom(viewCenteredOn(e.app.screen, tokenCenter(target, scene.gridSize), e.world.scale.x));
      return;
    }
    const factor = viewCommand.kind === "zoomIn" ? ZOOM_STEP : 1 / ZOOM_STEP;
    setView(e.world, zoomAround(viewOf(e.world), center, factor, minZoomFor(e.app.screen, latest.current.scene), MAX_ZOOM));
  }, [viewCommand, latest]);

  // A ping from anyone shows as a ring that grows and fades; a "look here" also brings the view to it.
  const ping = useTableUi((ui) => ui.ping);
  useEffect(() => {
    const e = engine.current;
    // The game master is sent every floor's pings, but only the ones on the floor being looked at belong on this map.
    if (!e || !ping || ping.sceneId !== latest.current.scene?.id || ping.floorId !== latest.current.floor?.id) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (ping.focus) {
      e.world.position.copyFrom(viewCenteredOn(e.app.screen, ping, e.world.scale.x));
    }
    const grid = latest.current.scene.gridSize;
    const ring = new Graphics();
    ring.position.set(ping.x, ping.y);
    e.world.addChild(ring);
    const color = ping.focus ? 0xffc914 : 0x66d9ff;
    const started = performance.now();
    const DURATION_MS = 1600;
    const step = () => {
      const t = Math.min(1, (performance.now() - started) / DURATION_MS);
      if (ring.destroyed) return void e.app.ticker.remove(step);
      const radius = grid * (reduced ? 0.8 : 0.3 + 1.2 * t);
      ring
        .clear()
        .circle(0, 0, radius)
        .stroke({ width: 4, color, alpha: 1 - t });
      ring.circle(0, 0, grid * 0.12).fill({ color, alpha: 1 - t });
      if (t >= 1) {
        e.app.ticker.remove(step);
        ring.destroy();
      }
    };
    e.app.ticker.add(step);
    return () => {
      e.app.ticker.remove(step);
      if (!ring.destroyed) ring.destroy();
    };
  }, [ping, latest]);

  // Effects the game master starts play once on every screen showing that floor; they stop with the map.
  const effect = useTableUi((ui) => ui.effect);
  // An arrival, a hit or a healing the game master fired on a token already covers that token changing, so the
  // same effect is not drawn twice.
  const recentArrivals = useRef<{ kind: string; x: number; y: number; at: number }[]>([]);
  useEffect(() => {
    const e = engine.current;
    // An effect that is already old (the map was mounted again since it was fired) is not replayed.
    if (!e || !effect || Date.now() - effect.at > EFFECT_FRESH_MS) return;
    if (effect.sceneId !== latest.current.scene?.id || effect.floorId !== latest.current.floor?.id) return;
    recentArrivals.current = [
      ...recentArrivals.current.filter((a) => Date.now() - a.at < 2000),
      ...(effect.kind === "arrive" || effect.kind === "damage" || effect.kind === "heal" ? [effect] : []),
    ];
    // Each effect ends by itself, so a newer one never cuts an older one short.
    playEffect(e.app, e.world, effect, latest.current.scene.gridSize, matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, [effect, latest]);

  // Tokens that arrive, lose hit points or heal show it on every screen, worked out from the state each already has.
  const seenTokens = useRef<{ floorKey: string; tokens: Map<string, TokenDto> } | null>(null);
  const { tokens: floorTokens, scene: currentScene, floor: currentFloor } = props;
  useEffect(() => {
    if (!currentScene || !currentFloor) return;
    const floorKey = `${currentScene.id}/${currentFloor.id}`;
    const seen = seenTokens.current;
    // The baseline is kept even before the map engine is ready, so the first change after it is ready is not lost.
    seenTokens.current = { floorKey, tokens: new Map(floorTokens.map((tk) => [tk.id, tk])) };
    const e = engine.current;
    // Opening a map or switching floors shows what is already there, not a burst of arrivals.
    if (!e || !seen || seen.floorKey !== floorKey) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A whole new list (a resync, a group placed at once) plays only the first few, so it cannot flood the map.
    const now = Date.now();
    const changes = tokenChangeEffects(seen.tokens, floorTokens, currentScene.gridSize, !currentScene.visionEnabled)
      .filter(
        (change) =>
          !recentArrivals.current.some(
            (a) => a.kind === change.kind && now - a.at < 2000 && Math.hypot(a.x - change.x, a.y - change.y) < currentScene.gridSize / 4,
          ),
      )
      .slice(0, MAX_TOKEN_EFFECTS);
    for (const change of changes)
      playEffect(e.app, e.world, { ...change, sceneId: currentScene.id, floorId: currentFloor.id }, currentScene.gridSize, reduced);
  }, [floorTokens, currentScene, currentFloor]);

  useEffect(() => {
    engine.current?.ruler.clear();
    if (engine.current) engine.current.rulerLabel.text = "";
  }, [props.tool]);

  // A hidden tab has nobody to watch the map: drawing stops and the video stops decoding until it is shown again.
  useEffect(() => {
    const onVisibilityChange = () => {
      const ticker = engine.current?.app.ticker;
      if (document.hidden) ticker?.stop();
      else ticker?.start();
      setVideoHidden(engine.current?.video, document.hidden);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // Pressing or dragging on the overview brings that spot to the middle of the view.
  const moveViewTo = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const e = engine.current;
    const scene = latest.current.scene;
    if (!e || !scene || event.buttons === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = sceneAt({ x: event.clientX - rect.left, y: event.clientY - rect.top }, minimapSize(scene), scene);
    e.world.position.copyFrom(viewCenteredOn(e.app.screen, point, e.world.scale.x));
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const toggleVideo = () => {
    const background = engine.current?.video;
    if (background) toggleVideoPlayback(background, setVideoUi);
  };

  return (
    <>
      <div
        ref={host}
        className="map-host"
        role="application"
        aria-label={t("map.label")}
        onDragOver={(e) => e.dataTransfer.types.includes(COMPENDIUM_DRAG_TYPE) && e.preventDefault()}
        onDrop={(e) => {
          const entryId = e.dataTransfer.getData(COMPENDIUM_DRAG_TYPE);
          const world = engine.current?.world;
          if (!entryId || !world) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const point = world.toLocal({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          props.onDropEntry(entryId, point.x, point.y);
        }}
      />
      {renderFailed && (
        <p role="alert" className="video-control video-notice">
          {t("map.renderUnavailable")}
        </p>
      )}
      {minimapOpen && props.scene && (
        // The overview is a pointer shortcut; the keyboard has pan, zoom and "center on my token".
        <div aria-hidden="true" className="minimap">
          <canvas
            ref={minimap}
            style={{ width: minimapSize(props.scene).width, height: minimapSize(props.scene).height, maxWidth: MINIMAP_MAX_SIDE }}
            onPointerDown={moveViewTo}
            onPointerMove={moveViewTo}
          />
        </div>
      )}
      {videoUi.status === "ready" && (
        <Button variant="secondary" size="sm" className="video-control" onClick={toggleVideo}>
          <Icon name={videoUi.playing ? "pause" : "play"} />
          {t(videoUi.playing ? "map.pauseVideo" : "map.playVideo")}
        </Button>
      )}
      {videoUi.status === "unsupported" && (
        <p role="alert" className="video-control video-notice">
          {t("map.videoUnsupported")}
        </p>
      )}
    </>
  );
}
