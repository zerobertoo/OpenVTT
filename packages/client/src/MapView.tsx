import type { SceneDto, TokenDto, VisionDto } from "@openvtt/shared";
import { Application, Container, type FederatedPointerEvent, Graphics, Sprite, Text, Texture, type Ticker, VideoSource } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { assetUrl } from "./api";
import { Button } from "./components/ui/button";
import { Icon } from "./icons";
import { applyTwoFingerGesture, type TwoFingerState, twoFingerState } from "./lib/gestures";
import { closeVideo, openVideo } from "./lib/media";
import { useTableUi } from "./tableStore";

export type MapTool = "select" | "ruler";

interface Props {
  scene: SceneDto | null;
  tokens: TokenDto[];
  tool: MapTool;
  selectedTokenId: string | null;
  canControl: (token: TokenDto) => boolean;
  onSelect: (tokenId: string | null) => void;
  /** Called while dragging (throttled) and once on drop with the snapped position. */
  onMove: (tokenId: string, x: number, y: number) => void;
  /** What this player can see; null shows the whole map (the game master, or a scene without vision). */
  vision: VisionDto | null;
  /** Draw walls, doors and lights (only the game master receives them). */
  showMapData: boolean;
  onToggleDoor: (wallId: string, open: boolean) => void;
  /** Formats the ruler label; receives distance in grid cells. */
  formatDistance: (cells: number) => string;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
/** How much one press of the zoom keys scales the view. */
const ZOOM_STEP = 1.25;

/** Shows the whole map centered in the view, never enlarged past its real size. */
function fitToScreen(world: Container, screen: { width: number; height: number }, scene: { width: number; height: number }) {
  const scale = Math.min(screen.width / scene.width, screen.height / scene.height, 1);
  world.scale.set(scale);
  world.position.set((screen.width - scene.width * scale) / 2, (screen.height - scene.height * scale) / 2);
}
const DRAG_SEND_INTERVAL_MS = 80;
const textureCache = new Map<string, Promise<Texture>>();

/** Pixi cannot infer the parser from our extension-less asset URLs, so decode through an ImageBitmap. */
function loadTexture(assetId: string): Promise<Texture> {
  let cached = textureCache.get(assetId);
  if (!cached) {
    cached = fetch(assetUrl(assetId))
      .then((r) => r.blob())
      .then((blob) => createImageBitmap(blob))
      .then((bitmap) => Texture.from(bitmap));
    textureCache.set(assetId, cached);
  }
  return cached;
}

const hexToNumber = (hex: string) => parseInt(hex.slice(1), 16);

/** An animated map background. Only one lives at a time; it is rebuilt only when the scene's asset changes. */
interface VideoBackground {
  assetId: string;
  /** What the person asked for; the element itself also pauses while the tab is hidden. */
  wantPlaying: boolean;
  loaded: { element: HTMLVideoElement; texture: Texture } | null;
  /** Resolves to null when the browser cannot play the file. */
  ready: Promise<{ element: HTMLVideoElement; texture: Texture } | null>;
}

interface VideoUi {
  status: "none" | "ready" | "unsupported";
  playing: boolean;
}

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
    fog: Graphics;
    fogHole: Graphics;
    tokenLayer: Container;
    ruler: Graphics;
    rulerLabel: Text;
    tokenViews: Map<string, Container>;
    fitted: string | null;
    video: VideoBackground | null;
  } | null>(null);
  const [videoUi, setVideoUi] = useState<VideoUi>({ status: "none", playing: false });

  // One Pixi application for the lifetime of the component.
  useEffect(() => {
    const element = host.current!;
    const app = new Application();
    let destroyed = false;
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
        const fog = new Graphics();
        fog.eventMode = "none";
        // The visible area, used as an inverse mask: fog is drawn everywhere except under it.
        const fogHole = new Graphics();
        fog.setMask({ mask: fogHole, inverse: true });
        const tokenLayer = new Container();
        const ruler = new Graphics();
        const rulerLabel = new Text({ text: "", style: { fill: 0xffffff, fontSize: 16, stroke: { color: 0x000000, width: 4 } } });
        world.addChild(background, grid, mapData, tokenLayer, fog, fogHole, ruler, rulerLabel);
        app.stage.addChild(world);
        app.stage.eventMode = "static";
        app.stage.hitArea = app.screen;
        engine.current = {
          app,
          world,
          background,
          grid,
          mapData,
          fog,
          fogHole,
          tokenLayer,
          ruler,
          rulerLabel,
          tokenViews: new Map(),
          fitted: null,
          video: null,
        };
        bindInteractions(app, world, ruler, rulerLabel);
        syncAll.current();
      });

    function bindInteractions(app: Application, world: Container, ruler: Graphics, label: Text) {
      let panning: { x: number; y: number } | null = null;
      let rulerStart: { x: number; y: number } | null = null;
      const toWorld = (e: FederatedPointerEvent) => world.toLocal(e.global);

      app.stage.on("pointerdown", (e) => {
        const p = props_().tool;
        if (e.button === 1 || e.button === 2 || (p === "select" && e.target === app.stage)) {
          panning = { x: e.global.x - world.x, y: e.global.y - world.y };
          if (p === "select" && e.button === 0) props_().onSelect(null);
        } else if (p === "ruler" && e.button === 0) {
          rulerStart = toWorld(e);
        }
      });
      app.stage.on("pointermove", (e) => {
        if (panning) {
          world.position.set(e.global.x - panning.x, e.global.y - panning.y);
        } else if (rulerStart) {
          const end = toWorld(e);
          const scene = props_().scene;
          ruler
            .clear()
            .moveTo(rulerStart.x, rulerStart.y)
            .lineTo(end.x, end.y)
            .stroke({ width: 3 / world.scale.x, color: 0xffc914 });
          const cells = scene ? Math.hypot(end.x - rulerStart.x, end.y - rulerStart.y) / scene.gridSize : 0;
          label.text = props_().formatDistance(cells);
          label.scale.set(1 / world.scale.x);
          label.position.set(end.x + 8 / world.scale.x, end.y + 8 / world.scale.x);
        }
      });
      const stop = () => {
        panning = null;
        if (rulerStart) {
          // Ruler stays visible until the next measurement or tool change.
          rulerStart = null;
        }
      };
      app.stage.on("pointerup", stop);
      app.stage.on("pointerupoutside", stop);
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
            panning = null;
            rulerStart = null;
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
          const view = applyTwoFingerGesture({ scale: world.scale.x, x: world.x, y: world.y }, twoFingers, next, MIN_ZOOM, MAX_ZOOM);
          world.scale.set(view.scale);
          world.position.set(view.x, view.y);
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
          const before = world.toLocal(cursor);
          const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, world.scale.x * Math.exp(-e.deltaY * 0.0015)));
          world.scale.set(next);
          world.position.set(cursor.x - before.x * next, cursor.y - before.y * next);
        },
        { passive: false },
      );
    }

    const props_ = () => latest.current;
    syncAll.current = () => {
      void syncScene();
      syncTokens();
      syncFog();
    };

    async function syncScene() {
      const e = engine.current;
      const scene = props_().scene;
      if (!e) return;
      e.background.removeChildren().forEach((c) => c.destroy());
      e.grid.clear();
      e.mapData.removeChildren().forEach((c) => c.destroy({ children: true }));
      e.ruler.clear();
      e.rulerLabel.text = "";
      if (!scene) return void disposeVideo(e);
      const sceneId = scene.id;
      if (scene.assetId && scene.assetKind === "video") {
        if (e.video?.assetId !== scene.assetId) {
          disposeVideo(e);
          e.video = startVideo(e, scene.assetId);
        }
        const loaded = await e.video.ready;
        // Another scene was shown while the video loaded; its own sync draws the map.
        if (props_().scene?.id !== sceneId) return;
        e.background.removeChildren().forEach((c) => c.destroy());
        if (loaded) {
          const sprite = new Sprite(loaded.texture);
          sprite.width = scene.width;
          sprite.height = scene.height;
          e.background.addChild(sprite);
        } else {
          // Without the video the map is still usable: plain background plus grid and tokens.
          e.background.addChild(new Graphics().rect(0, 0, scene.width, scene.height).fill(0x2a2d34));
        }
      } else if (scene.assetId) {
        disposeVideo(e);
        const texture = await loadTexture(scene.assetId);
        if (engine.current?.fitted !== null && props_().scene?.id !== sceneId) return;
        const sprite = new Sprite(texture);
        sprite.width = scene.width;
        sprite.height = scene.height;
        e.background.addChild(sprite);
      } else {
        disposeVideo(e);
        e.background.addChild(new Graphics().rect(0, 0, scene.width, scene.height).fill(0x2a2d34));
      }
      e.grid.clear();
      if (scene.gridType === "square") {
        for (let x = 0; x <= scene.width; x += scene.gridSize) e.grid.moveTo(x, 0).lineTo(x, scene.height);
        for (let y = 0; y <= scene.height; y += scene.gridSize) e.grid.moveTo(0, y).lineTo(scene.width, y);
        e.grid.stroke({ width: 1, color: 0xffffff, alpha: 0.25 });
      }
      if (props_().showMapData) drawMapData(e, scene);
      if (e.fitted !== sceneId) {
        // Fit the whole map in view the first time a scene is shown.
        fitToScreen(e.world, e.app.screen, scene);
        e.fitted = sceneId;
      }
    }

    /** Lights as soft discs, walls as red lines, doors as amber (closed) or green (open) lines with a handle to open them. */
    function drawMapData(e: NonNullable<typeof engine.current>, scene: SceneDto) {
      const lights = new Graphics();
      for (const light of scene.lights) {
        const radius = light.radius * scene.gridSize;
        lights.circle(light.x, light.y, radius).fill({ color: hexToNumber(light.color), alpha: 0.12 });
        lights
          .circle(light.x, light.y, Math.max(4, scene.gridSize / 8))
          .fill({ color: hexToNumber(light.color) })
          .stroke({ width: 2, color: 0x000000 });
      }
      const walls = new Graphics();
      const doors = new Container();
      const line = (g: Graphics, w: SceneDto["walls"][number]) => g.moveTo(w.x1, w.y1).lineTo(w.x2, w.y2);
      for (const wall of scene.walls) {
        if (wall.kind === "wall") {
          line(walls, wall);
          continue;
        }
        const door = new Graphics();
        line(door, wall).stroke({ width: wall.open ? 3 : 6, color: wall.open ? 0x3ddc84 : 0xffb000, alpha: wall.open ? 0.7 : 1 });
        // A handle at the middle of the door: a bigger target than the line, also for touch.
        const handle = new Graphics()
          .circle((wall.x1 + wall.x2) / 2, (wall.y1 + wall.y2) / 2, Math.max(12, scene.gridSize / 4))
          .fill({ color: wall.open ? 0x3ddc84 : 0xffb000, alpha: 0.35 });
        handle.eventMode = "static";
        handle.cursor = "pointer";
        handle.on("pointerdown", (event) => {
          if (props_().tool !== "select" || event.button !== 0) return;
          event.stopPropagation();
          props_().onToggleDoor(wall.id, !wall.open);
        });
        door.addChild(handle);
        doors.addChild(door);
      }
      walls.stroke({ width: 5, color: 0xff4d4d });
      e.mapData.addChild(lights, walls, doors);
    }

    /** Darkens everything a player cannot see right now; the polygons come from the server, which never sends walls. */
    function syncFog() {
      const e = engine.current;
      const { scene, vision } = props_();
      if (!e) return;
      e.fog.clear();
      e.fogHole.clear();
      if (!scene || !vision || vision.sceneId !== scene.id) return;
      e.fog.rect(0, 0, scene.width, scene.height).fill({ color: 0x000000, alpha: 0.94 });
      for (const polygon of vision.polygons) if (polygon.length >= 6) e.fogHole.poly(polygon).fill(0xffffff);
    }

    /** Starts loading an animated background; it plays at once unless the person prefers reduced motion. */
    function startVideo(e: NonNullable<typeof engine.current>, assetId: string): VideoBackground {
      const background: VideoBackground = {
        assetId,
        wantPlaying: !matchMedia("(prefers-reduced-motion: reduce)").matches,
        loaded: null,
        ready: Promise.resolve(null),
      };
      background.ready = openVideo(assetUrl(assetId)).then(
        async (element) => {
          // The scene changed while the file loaded: drop it without ever showing it.
          if (e.video !== background) {
            closeVideo(element);
            return null;
          }
          const texture = new Texture({ source: new VideoSource({ resource: element, autoPlay: false }) });
          background.loaded = { element, texture };
          if (background.wantPlaying) await element.play().catch(() => void (background.wantPlaying = false));
          // A decode failure after the first frame (corrupt file, lost connection) ends the animation cleanly.
          element.addEventListener("error", () => setVideoUi({ status: "unsupported", playing: false }));
          setVideoUi({ status: "ready", playing: background.wantPlaying });
          return background.loaded;
        },
        () => {
          if (e.video === background) setVideoUi({ status: "unsupported", playing: false });
          return null;
        },
      );
      return background;
    }

    function disposeVideo(e: NonNullable<typeof engine.current>) {
      const background = e.video;
      if (!background) return;
      e.video = null;
      setVideoUi({ status: "none", playing: false });
      void background.ready.then((loaded) => loaded?.texture.destroy(true));
    }

    function syncTokens() {
      const e = engine.current;
      if (!e) return;
      const { tokens, scene, selectedTokenId } = props_();
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
        drawToken(view, token, scene!.gridSize, token.id === selectedTokenId);
      }
    }

    function createTokenView(token: TokenDto): Container {
      const view = new Container();
      view.eventMode = "static";
      view.cursor = "pointer";
      let drag: { dx: number; dy: number; lastSent: number } | null = null;
      view.on("pointerdown", (e) => {
        if (props_().tool !== "select" || e.button !== 0) return;
        e.stopPropagation();
        props_().onSelect(token.id);
        const current = currentToken(token.id);
        if (!current || !props_().canControl(current)) return;
        const local = engine.current!.world.toLocal(e.global);
        drag = { dx: local.x - current.x, dy: local.y - current.y, lastSent: 0 };
      });
      view.on("globalpointermove", (e) => {
        if (!drag) return;
        if (pinching) return void (drag = null);
        const scene = props_().scene;
        const current = currentToken(token.id);
        if (!scene || !current) return;
        const local = engine.current!.world.toLocal(e.global);
        const x = local.x - drag.dx;
        const y = local.y - drag.dy;
        view.position.set(x + (current.size * scene.gridSize) / 2, y + (current.size * scene.gridSize) / 2);
        const now = performance.now();
        if (now - drag.lastSent > DRAG_SEND_INTERVAL_MS) {
          drag.lastSent = now;
          props_().onMove(token.id, x, y);
        }
      });
      const drop = () => {
        const scene = props_().scene;
        const current = currentToken(token.id);
        if (!drag || !scene || !current) return void (drag = null);
        drag = null;
        const half = (current.size * scene.gridSize) / 2;
        let x = view.x - half;
        let y = view.y - half;
        if (scene.gridType === "square") {
          x = Math.round(x / scene.gridSize) * scene.gridSize;
          y = Math.round(y / scene.gridSize) * scene.gridSize;
        }
        view.position.set(x + half, y + half);
        props_().onMove(token.id, x, y);
        popScale(app.ticker, view, 1.15, 240);
      };
      view.on("pointerup", drop);
      view.on("pointerupoutside", drop);
      popScale(app.ticker, view, 0, 360);
      return view;
    }

    const currentToken = (id: string) => props_().tokens.find((t) => t.id === id);

    function drawToken(view: Container, token: TokenDto, gridSize: number, selected: boolean) {
      const px = token.size * gridSize;
      view.removeChildren().forEach((c) => c.destroy());
      view.pivot.set(0, 0);
      view.position.set(token.x + px / 2, token.y + px / 2);
      view.rotation = (token.rotation * Math.PI) / 180;
      const body = new Graphics().circle(0, 0, px / 2 - 2).fill({ color: hexToNumber(token.color), alpha: token.hidden ? 0.45 : 1 });
      body.stroke({ width: selected ? 4 : 2, color: selected ? 0xffffff : 0x000000 });
      view.addChild(body);
      if (token.assetId) {
        const assetId = token.assetId;
        void loadTexture(assetId).then((texture) => {
          if (view.destroyed) return;
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5);
          sprite.width = sprite.height = px - 4;
          const mask = new Graphics().circle(0, 0, px / 2 - 2).fill(0xffffff);
          sprite.mask = mask;
          view.addChild(mask, sprite);
        });
      } else {
        const initial = new Text({
          text: token.name.slice(0, 2).toUpperCase(),
          style: { fill: 0xffffff, fontSize: Math.max(10, px / 3), fontWeight: "700", stroke: { color: 0x000000, width: 3 } },
        });
        initial.anchor.set(0.5);
        view.addChild(initial);
      }
    }

    return () => {
      destroyed = true;
      void ready.then(() => {
        if (engine.current) disposeVideo(engine.current);
        engine.current = null;
        app.destroy(true, { children: true });
      });
    };
    // The application is created once; prop changes are pushed through `syncAll` below.
  }, []);

  useEffect(() => {
    syncAll.current();
  }, [props.scene, props.tokens, props.selectedTokenId, props.showMapData, props.vision]);

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
    const before = e.world.toLocal(center);
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, e.world.scale.x * (viewCommand.kind === "zoomIn" ? ZOOM_STEP : 1 / ZOOM_STEP)));
    e.world.scale.set(next);
    e.world.position.set(center.x - before.x * next, center.y - before.y * next);
  }, [viewCommand, latest]);

  useEffect(() => {
    engine.current?.ruler.clear();
    if (engine.current) engine.current.rulerLabel.text = "";
  }, [props.tool]);

  // A hidden tab has nobody to watch the map, so the video stops decoding until it is shown again.
  useEffect(() => {
    const onVisibilityChange = () => {
      const background = engine.current?.video;
      if (!background?.loaded) return;
      if (document.hidden) background.loaded.element.pause();
      else if (background.wantPlaying) void background.loaded.element.play().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const toggleVideo = () => {
    const background = engine.current?.video;
    if (!background?.loaded) return;
    background.wantPlaying = !background.wantPlaying;
    if (background.wantPlaying) {
      void background.loaded.element.play().catch(() => {
        background.wantPlaying = false;
        setVideoUi({ status: "ready", playing: false });
      });
    } else background.loaded.element.pause();
    setVideoUi({ status: "ready", playing: background.wantPlaying });
  };

  return (
    <>
      <div ref={host} className="map-host" role="application" aria-label={t("map.label")} />
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
