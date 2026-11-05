import type { EnvironmentDto } from "@openvtt/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { environmentLook, type Tint } from "../../lib/environment";
import { thunder } from "../../lib/sound";
import { WeatherScene } from "../../lib/weatherScene";

const TINT_FADE_MS = 1400;

/** Keeps a tint on screen while it fades out, so changing the time or weather blends instead of cutting. */
function useFadingTints(tints: Tint[]) {
  const [items, setItems] = useState(() => tints.map((tint) => ({ tint, on: true })));
  useEffect(() => {
    setItems((previous) => [
      ...tints.map((tint) => ({ tint, on: true })),
      ...previous.filter((old) => !tints.some((t) => t.color === old.tint.color)).map((old) => ({ tint: old.tint, on: false })),
    ]);
    const timer = setTimeout(() => setItems((current) => current.filter((item) => item.on)), TINT_FADE_MS + 100);
    return () => clearTimeout(timer);
  }, [tints]);
  return items;
}

/** Colour washes plus weather: rain, storm, snow, fog, leaves and petals blending into each other. It never takes clicks. */
export function EnvironmentOverlay({ environment }: { environment: EnvironmentDto }) {
  const { time, weather, season } = environment;
  const look = useMemo(() => environmentLook({ time, weather, season }), [time, weather, season]);
  const tints = useFadingTints(look.tints);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<WeatherScene | null>(null);
  const kick = useRef<() => void>(() => undefined);
  // True while the weather has anything left on screen, including layers that are still fading out.
  const [busy, setBusy] = useState(look.particles.length > 0);
  const show = busy || tints.length > 0 || look.particles.length > 0;
  const particlesKey = look.particles.join();

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const weatherScene = new WeatherScene({ reduced, onThunder: thunder });
    scene.current = weatherScene;
    let ratio = 1;

    const paint = () => {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, weatherScene.width, weatherScene.height);
      weatherScene.draw(ctx);
    };
    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.max(1, Math.floor(element.clientWidth * ratio));
      element.height = Math.max(1, Math.floor(element.clientHeight * ratio));
      weatherScene.resize(element.clientWidth, element.clientHeight);
      paint();
    };
    resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(element);

    let frame = 0;
    let running = false;
    let last = 0;
    const tick = (now: number) => {
      // Clamped so a background tab coming back does not make everything jump.
      weatherScene.step(Math.min((now - last) / 1000, 0.05));
      last = now;
      paint();
      if (weatherScene.idle) {
        running = false;
        setBusy(false);
      } else frame = requestAnimationFrame(tick);
    };
    kick.current = () => {
      if (reduced) {
        paint();
        if (weatherScene.idle) setBusy(false);
      } else if (!running) {
        running = true;
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    weatherScene.setKinds(look.particles);
    kick.current();

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      scene.current = null;
      kick.current = () => undefined;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: the scene is made once per mount; kinds are applied below
  }, [show]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the key stands for the particle list
  useEffect(() => {
    if (look.particles.length > 0) setBusy(true);
    scene.current?.setKinds(look.particles);
    kick.current();
  }, [particlesKey]);

  if (!show) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="environment-overlay">
      {tints.map(({ tint, on }) => (
        <div
          key={tint.color}
          className="env-tint absolute inset-0"
          style={{ background: tint.color, mixBlendMode: tint.blend, opacity: on ? 1 : 0 }}
        />
      ))}
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  );
}
