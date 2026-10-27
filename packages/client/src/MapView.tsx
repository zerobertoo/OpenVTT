import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Application, Container, Graphics, Sprite, Text, Texture, type FederatedPointerEvent, type Ticker } from "pixi.js";
import type { SceneDto, TokenDto } from "@openvtt/shared";
import { assetUrl } from "./api";

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
  /** Formats the ruler label; receives distance in grid cells. */
  formatDistance: (cells: number) => string;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
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
    tokenLayer: Container;
    ruler: Graphics;
    rulerLabel: Text;
    tokenViews: Map<string, Container>;
    fitted: string | null;
  } | null>(null);

  // One Pixi application for the lifetime of the component.
  useEffect(() => {
    const element = host.current!;
    const app = new Application();
    let destroyed = false;
    const ready = app
      .init({ resizeTo: element, background: 0x1b1d22, antialias: true, resolution: window.devicePixelRatio, autoDensity: true })
      .then(() => {
        if (destroyed) return;
        element.appendChild(app.canvas);
        const world = new Container();
        const background = new Container();
        const grid = new Graphics();
        const tokenLayer = new Container();
        const ruler = new Graphics();
        const rulerLabel = new Text({ text: "", style: { fill: 0xffffff, fontSize: 16, stroke: { color: 0x000000, width: 4 } } });
        world.addChild(background, grid, tokenLayer, ruler, rulerLabel);
        app.stage.addChild(world);
        app.stage.eventMode = "static";
        app.stage.hitArea = app.screen;
        engine.current = { app, world, background, grid, tokenLayer, ruler, rulerLabel, tokenViews: new Map(), fitted: null };
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
          ruler.clear().moveTo(rulerStart.x, rulerStart.y).lineTo(end.x, end.y).stroke({ width: 3 / world.scale.x, color: 0xffc914 });
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
    };

    async function syncScene() {
      const e = engine.current;
      const scene = props_().scene;
      if (!e) return;
      e.background.removeChildren().forEach((c) => c.destroy());
      e.grid.clear();
      e.ruler.clear();
      e.rulerLabel.text = "";
      if (!scene) return;
      const sceneId = scene.id;
      if (scene.assetId) {
        const texture = await loadTexture(scene.assetId);
        if (engine.current?.fitted !== null && props_().scene?.id !== sceneId) return;
        const sprite = new Sprite(texture);
        sprite.width = scene.width;
        sprite.height = scene.height;
        e.background.addChild(sprite);
      } else {
        e.background.addChild(new Graphics().rect(0, 0, scene.width, scene.height).fill(0x2a2d34));
      }
      if (scene.gridType === "square") {
        for (let x = 0; x <= scene.width; x += scene.gridSize) e.grid.moveTo(x, 0).lineTo(x, scene.height);
        for (let y = 0; y <= scene.height; y += scene.gridSize) e.grid.moveTo(0, y).lineTo(scene.width, y);
        e.grid.stroke({ width: 1, color: 0xffffff, alpha: 0.25 });
      }
      if (e.fitted !== sceneId) {
        // Fit the whole map in view the first time a scene is shown.
        const scale = Math.min(e.app.screen.width / scene.width, e.app.screen.height / scene.height, 1);
        e.world.scale.set(scale);
        e.world.position.set((e.app.screen.width - scene.width * scale) / 2, (e.app.screen.height - scene.height * scale) / 2);
        e.fitted = sceneId;
      }
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
        const initial = new Text({ text: token.name.slice(0, 2).toUpperCase(), style: { fill: 0xffffff, fontSize: Math.max(10, px / 3), fontWeight: "700", stroke: { color: 0x000000, width: 3 } } });
        initial.anchor.set(0.5);
        view.addChild(initial);
      }
    }

    return () => {
      destroyed = true;
      void ready.then(() => {
        engine.current = null;
        app.destroy(true, { children: true });
      });
    };
    // The application is created once; prop changes are pushed through `syncAll` below.
  }, []);

  useEffect(() => {
    syncAll.current();
  }, [props.scene, props.tokens, props.selectedTokenId]);

  useEffect(() => {
    engine.current?.ruler.clear();
    if (engine.current) engine.current.rulerLabel.text = "";
  }, [props.tool]);

  return <div ref={host} className="map-host" role="application" aria-label={t("map.label")} />;
}
