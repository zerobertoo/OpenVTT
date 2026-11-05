import type { Graphics } from "pixi.js";
import { hexCentersIn, hexCorners, hexOrientationOf } from "./hex";

/** The part of a scene the grid is drawn from. */
export interface GridDrawing {
  gridType: string;
  gridSize: number;
  width: number;
  height: number;
}

/** Two scenes with the same key have the same grid, so the lines need not be drawn again. */
export const gridKey = (scene: GridDrawing) => `${scene.gridType} ${scene.gridSize} ${scene.width} ${scene.height}`;

/** Redraws the whole grid into `g`: lines on every cell boundary for a square grid, hexagons for a hex grid, nothing without one. */
export function drawGrid(g: Graphics, scene: GridDrawing) {
  g.clear();
  if (scene.gridType === "square") {
    for (let x = 0; x <= scene.width; x += scene.gridSize) g.moveTo(x, 0).lineTo(x, scene.height);
    for (let y = 0; y <= scene.height; y += scene.gridSize) g.moveTo(0, y).lineTo(scene.width, y);
    g.stroke({ width: 1, color: 0xffffff, alpha: 0.25 });
  }
  const hex = hexOrientationOf(scene.gridType);
  if (hex) {
    for (const center of hexCentersIn(scene.width, scene.height, scene.gridSize, hex)) g.poly(hexCorners(center, scene.gridSize, hex));
    g.stroke({ width: 1, color: 0xffffff, alpha: 0.25 });
  }
}
