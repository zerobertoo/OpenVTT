/** How many images one import takes, so a stray selection cannot flood the table. */
export const MAX_BULK_TOKENS = 30;

/** "goblin_archer-02.png" becomes "goblin archer 02". */
export function tokenNameFromFile(fileName: string): string {
  const name = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (name || "Token").slice(0, 60);
}

/** Lays tokens out in rows of one-cell steps, starting one cell in from the corner and wrapping at the map's edge. */
export function bulkPosition(index: number, scene: { width: number; gridSize: number }): { x: number; y: number } {
  const columns = Math.max(1, Math.floor(scene.width / scene.gridSize) - 1);
  return { x: scene.gridSize * (1 + (index % columns)), y: scene.gridSize * (1 + Math.floor(index / columns)) };
}
