import type { DrawingDto, TokenDto } from "@openvtt/shared";
import { Container, Graphics, Text } from "pixi.js";
import { arrowHead } from "./drawings";
import { CONDITION_GLYPHS, healthColor, healthRatio } from "./tokenStatus";

/** A colour stored as "#rrggbb" in the data, as the number Pixi draws with. */
export const hexToNumber = (hex: string) => parseInt(hex.slice(1), 16);

export function drawingView(drawing: DrawingDto, gridSize: number): Container {
  const [x, y] = drawing.points as [number, number];
  if (drawing.kind === "text" || drawing.kind === "note") {
    const view = new Container();
    view.position.set(x, y);
    const color = hexToNumber(drawing.color);
    const label = new Text({
      text: drawing.text,
      style: {
        fill: color,
        fontSize: Math.max(14, gridSize / 2.6),
        fontWeight: "600",
        stroke: { color: 0x000000, width: 4 },
        wordWrap: true,
        wordWrapWidth: gridSize * 6,
      },
    });
    if (drawing.kind === "note") {
      view.addChild(
        new Graphics()
          .circle(0, 0, Math.max(8, gridSize / 6))
          .fill(color)
          .stroke({ width: 3, color: 0x000000 }),
      );
      label.anchor.set(0.5, 0);
      label.position.set(0, Math.max(10, gridSize / 5));
    } else label.anchor.set(0, 0.5);
    view.addChild(label);
    return view;
  }
  const shape = new Graphics();
  renderShape(shape, drawing, gridSize);
  return shape;
}

/** Draws a line-based mark into `g`; also used for the preview while the pointer is down. */
export function renderShape(g: Graphics, drawing: Pick<DrawingDto, "kind" | "points" | "color">, gridSize: number) {
  const p = drawing.points;
  const stroke = {
    width: Math.max(3, gridSize / 20),
    color: hexToNumber(drawing.color),
    cap: "round" as const,
    join: "round" as const,
  };
  if (p.length < 4) return;
  const [x1, y1, x2, y2] = [p[0]!, p[1]!, p.at(-2)!, p.at(-1)!];
  if (drawing.kind === "rect") g.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)).stroke(stroke);
  else if (drawing.kind === "circle") g.circle(x1, y1, Math.hypot(x2 - x1, y2 - y1)).stroke(stroke);
  else {
    g.moveTo(x1, y1);
    if (drawing.kind === "free") for (let i = 2; i < p.length; i += 2) g.lineTo(p[i]!, p[i + 1]!);
    else g.lineTo(x2, y2);
    if (drawing.kind === "arrow") {
      const [left, right] = arrowHead({ x: x1, y: y1 }, { x: x2, y: y2 }, Math.max(14, gridSize / 3));
      g.moveTo(left.x, left.y).lineTo(x2, y2).lineTo(right.x, right.y);
    }
    g.stroke(stroke);
  }
}

/** Health bar, name and condition badges around a token; counter-rotated so they stay upright and out of the way of clicks. */
export function drawStatus(token: TokenDto, px: number, gridSize: number): Container {
  const status = new Container();
  status.eventMode = "none";
  status.rotation = -((token.rotation * Math.PI) / 180);
  let belowY = px / 2 + 2;
  if (token.hp !== null && token.hpMax !== null) {
    const width = px * 0.9;
    const height = Math.max(5, gridSize / 10);
    const ratio = healthRatio(token.hp, token.hpMax);
    const bar = new Graphics().roundRect(-width / 2, belowY, width, height, height / 2).fill({ color: 0x000000, alpha: 0.7 });
    if (ratio > 0)
      bar.roundRect(-width / 2, belowY, Math.max(height, width * ratio), height, height / 2).fill({ color: healthColor(ratio) });
    status.addChild(bar);
    belowY += height + 2;
  }
  if (token.showName) {
    const name = new Text({
      text: token.name,
      style: { fill: 0xffffff, fontSize: Math.max(12, gridSize / 4.5), fontWeight: "600", stroke: { color: 0x000000, width: 4 } },
    });
    name.anchor.set(0.5, 0);
    name.position.set(0, belowY);
    status.addChild(name);
  }
  const badge = Math.max(16, gridSize / 3.4);
  token.conditions.slice(0, 4).forEach((id, i, shown) => {
    const glyph = new Text({ text: CONDITION_GLYPHS[id as keyof typeof CONDITION_GLYPHS] ?? "", style: { fontSize: badge * 0.85 } });
    glyph.anchor.set(0.5);
    glyph.position.set((i - (shown.length - 1) / 2) * badge, -px / 2 - badge * 0.2);
    status.addChild(glyph);
  });
  return status;
}
