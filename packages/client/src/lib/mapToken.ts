import type { TokenDto } from "@openvtt/shared";
import { type Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { drawStatus, hexToNumber } from "./mapShapes";

/** How many times each view was drawn, so a picture that finishes loading for an older drawing is dropped. */
const drawCount = new WeakMap<Container, number>();

/**
 * Draws a token into `view`, replacing what was there: a coloured disc with its outline, health and conditions, and
 * either its picture (masked to the disc, added once `loadImage` resolves) or the first letters of its name.
 */
export function drawTokenView(
  view: Container,
  token: TokenDto,
  gridSize: number,
  selected: boolean,
  loadImage: (assetId: string) => Promise<Texture | null>,
) {
  const drawing = (drawCount.get(view) ?? 0) + 1;
  drawCount.set(view, drawing);
  const px = token.size * gridSize;
  for (const child of view.removeChildren()) child.destroy({ children: true });
  view.pivot.set(0, 0);
  view.position.set(token.x + px / 2, token.y + px / 2);
  view.rotation = (token.rotation * Math.PI) / 180;
  const body = new Graphics().circle(0, 0, px / 2 - 2).fill({ color: hexToNumber(token.color), alpha: token.hidden ? 0.45 : 1 });
  body.stroke({ width: selected ? 4 : 2, color: selected ? 0xffffff : 0x000000 });
  view.addChild(body);
  view.addChild(drawStatus(token, px, gridSize));
  if (token.assetId) {
    void loadImage(token.assetId).then((texture) => {
      if (!texture || view.destroyed || drawCount.get(view) !== drawing) return;
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
