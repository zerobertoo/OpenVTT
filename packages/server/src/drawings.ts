import { randomUUID } from "node:crypto";
import { type createDrawingSchema, type DrawingDto, MAX_SCENE_DRAWINGS } from "@openvtt/shared";
import type { z } from "zod";
import type { Db } from "./db.ts";
import { AppError } from "./errors.ts";
import type { Viewer } from "./tokens.ts";

type DrawingInput = z.infer<typeof createDrawingSchema>;

/** Drawings, arrows, texts and the game master's note pins on a scene. */
export class DrawingService {
  constructor(private db: Db) {}

  /** The scene and world a drawing belongs to, or null. */
  find(drawingId: string): { sceneId: string; worldId: string; authorId: string | null; layer: DrawingDto["layer"] } | null {
    const row = this.db
      .prepare("SELECT d.scene_id, d.author_id, d.layer, s.world_id FROM drawings d JOIN scenes s ON s.id = d.scene_id WHERE d.id = ?")
      .get(drawingId) as { scene_id: string; author_id: string | null; layer: DrawingDto["layer"]; world_id: string } | undefined;
    return row ? { sceneId: row.scene_id, worldId: row.world_id, authorId: row.author_id, layer: row.layer } : null;
  }

  /** Players draw only on the objects layer of the active scene and never place note pins; notes always go to the `gm` layer. */
  create(sceneId: string, viewer: Viewer, activeSceneId: string | null, input: DrawingInput): string {
    const isGm = viewer.role === "gm";
    if (!isGm && (sceneId !== activeSceneId || input.kind === "note" || input.layer !== "objects")) throw new AppError("forbidden");
    const { n } = this.db.prepare("SELECT COUNT(*) AS n FROM drawings WHERE scene_id = ?").get(sceneId) as { n: number };
    if (n >= MAX_SCENE_DRAWINGS) throw new AppError("invalid_input");
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO drawings (id, scene_id, author_id, kind, layer, points, color, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        id,
        sceneId,
        viewer.userId,
        input.kind,
        input.kind === "note" ? "gm" : input.layer,
        JSON.stringify(input.points),
        input.color,
        input.text,
      );
    return id;
  }

  /** Imported drawings have no author. */
  insertImported(sceneId: string, input: DrawingInput) {
    this.db
      .prepare("INSERT INTO drawings (id, scene_id, author_id, kind, layer, points, color, text) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)")
      .run(
        randomUUID(),
        sceneId,
        input.kind,
        input.kind === "note" ? "gm" : input.layer,
        JSON.stringify(input.points),
        input.color,
        input.text,
      );
  }

  /** The game master erases anything; everybody else only what they drew themselves. */
  remove(drawingId: string, viewer: Viewer) {
    const found = this.find(drawingId);
    // A player is never told that a game master drawing exists.
    if (!found || (viewer.role !== "gm" && found.layer === "gm")) throw new AppError("not_found");
    if (viewer.role !== "gm" && found.authorId !== viewer.userId) throw new AppError("forbidden");
    this.db.prepare("DELETE FROM drawings WHERE id = ?").run(drawingId);
  }

  /** Clears the scene for the game master, or only the viewer's own drawings for anyone else. */
  clear(sceneId: string, viewer: Viewer) {
    if (viewer.role === "gm") this.db.prepare("DELETE FROM drawings WHERE scene_id = ?").run(sceneId);
    else this.db.prepare("DELETE FROM drawings WHERE scene_id = ? AND author_id = ? AND layer <> 'gm'").run(sceneId, viewer.userId);
  }
}
