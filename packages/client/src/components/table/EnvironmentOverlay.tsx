import type { EnvironmentDto } from "@openvtt/shared";
import { useEffect, useMemo, useRef } from "react";
import { environmentLook, type Particle, type ParticleKind, spawnParticles, stepParticle } from "../../lib/environment";

const LEAF_COLORS = ["#c4561c", "#d98a1f", "#a63d12"];
const PETAL_COLORS = ["#f6b8d0", "#fbd5e2", "#f29bbd"];

function drawParticle(ctx: CanvasRenderingContext2D, kind: ParticleKind, p: Particle) {
  if (kind === "rain" || kind === "storm") {
    const length = kind === "storm" ? 22 : 14;
    const slant = kind === "storm" ? 0.28 : 0.1;
    ctx.strokeStyle = "rgba(190, 210, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + length * slant, p.y - length);
    ctx.stroke();
  } else if (kind === "snow") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.2 + p.r * 2.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const colors = kind === "leaves" ? LEAF_COLORS : PETAL_COLORS;
    ctx.fillStyle = colors[Math.floor(p.r * colors.length)] ?? "#c4561c";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 3 + p.r * 3, 1.8 + p.r, p.r * 6.28 + p.y * 0.02, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Colour washes plus falling rain, snow, leaves or petals. It never takes clicks and stops moving for people who ask for less motion. */
export function EnvironmentOverlay({ environment }: { environment: EnvironmentDto }) {
  const { time, weather, season } = environment;
  const look = useMemo(() => environmentLook({ time, weather, season }), [time, weather, season]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const particlesKey = look.particles.join();
  const storm = weather === "storm";

  // biome-ignore lint/correctness/useExhaustiveDependencies: the key stands for the particle list
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx || look.particles.length === 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let width = 0;
    let height = 0;
    let layers: { kind: ParticleKind; items: Particle[] }[] = [];
    const resize = () => {
      width = element.width = element.clientWidth;
      height = element.height = element.clientHeight;
      layers = look.particles.map((kind) => ({ kind, items: spawnParticles(kind, width, height) }));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    let last = performance.now();
    let flash = 0;
    let nextFlash = last + 3000 + Math.random() * 6000;
    let frame = 0;
    const tick = (now: number) => {
      // Clamped so a background tab coming back does not make everything jump.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, width, height);
      for (const { kind, items } of layers)
        for (const p of items) {
          stepParticle(kind, p, dt, now / 1000, width, height);
          drawParticle(ctx, kind, p);
        }
      if (storm) {
        if (now > nextFlash) {
          flash = 0.55;
          nextFlash = now + 4000 + Math.random() * 8000;
        }
        if (flash > 0.01) {
          ctx.fillStyle = `rgba(235, 240, 255, ${flash})`;
          ctx.fillRect(0, 0, width, height);
          flash *= 0.88;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [particlesKey, storm]);

  if (look.tints.length === 0 && look.particles.length === 0) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="environment-overlay">
      {look.tints.map((tint) => (
        <div key={tint.color} className="absolute inset-0" style={{ background: tint.color, mixBlendMode: tint.blend }} />
      ))}
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  );
}
