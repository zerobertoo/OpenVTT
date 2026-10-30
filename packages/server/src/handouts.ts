import { randomUUID } from "node:crypto";
import type { HandoutDto, handoutInputSchema, updateHandoutSchema } from "@openvtt/shared";
import type { z } from "zod";
import type { Db } from "./db.ts";
import { AppError } from "./errors.ts";
import type { Viewer } from "./tokens.ts";

interface HandoutRow {
  id: string;
  world_id: string;
  title: string;
  body: string;
  audience: string;
}

type HandoutInput = z.infer<typeof handoutInputSchema>;

/** `audience` is `["*"]` for everyone, a list of user ids, or empty for the game master alone. */
const canRead = (audience: string[], viewer: Viewer) => viewer.role === "gm" || audience.includes("*") || audience.includes(viewer.userId);

/** Journal entries and handouts in markdown, shown to the people the game master picks. */
export class HandoutService {
  constructor(private db: Db) {}

  /** Players get only what is shared with them, and never the list of who else can read it. */
  visibleTo(worldId: string, viewer: Viewer): HandoutDto[] {
    const rows = this.db
      .prepare("SELECT * FROM handouts WHERE world_id = ? ORDER BY created_at, rowid")
      .all(worldId) as unknown as HandoutRow[];
    return rows.flatMap((r) => {
      const audience = JSON.parse(r.audience) as string[];
      if (!canRead(audience, viewer)) return [];
      return [{ id: r.id, title: r.title, body: r.body, audience: viewer.role === "gm" ? audience : [] }];
    });
  }

  worldIdOf(handoutId: string): string | null {
    const row = this.db.prepare("SELECT world_id FROM handouts WHERE id = ?").get(handoutId) as { world_id: string } | undefined;
    return row?.world_id ?? null;
  }

  create(worldId: string, input: HandoutInput): string {
    this.assertMembers(worldId, input.audience);
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO handouts (id, world_id, title, body, audience, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, worldId, input.title, input.body, JSON.stringify(input.audience), Date.now());
    return id;
  }

  update(handoutId: string, worldId: string, input: z.infer<typeof updateHandoutSchema>) {
    const current = this.db.prepare("SELECT * FROM handouts WHERE id = ?").get(handoutId) as HandoutRow | undefined;
    if (!current) throw new AppError("not_found");
    if (input.audience) this.assertMembers(worldId, input.audience);
    this.db
      .prepare("UPDATE handouts SET title = ?, body = ?, audience = ? WHERE id = ?")
      .run(
        input.title ?? current.title,
        input.body ?? current.body,
        input.audience ? JSON.stringify(input.audience) : current.audience,
        handoutId,
      );
  }

  remove(handoutId: string) {
    this.db.prepare("DELETE FROM handouts WHERE id = ?").run(handoutId);
  }

  private assertMembers(worldId: string, audience: string[]) {
    const isMember = this.db.prepare("SELECT 1 FROM members WHERE world_id = ? AND user_id = ?");
    for (const userId of audience) if (userId !== "*" && !isMember.get(worldId, userId)) throw new AppError("not_found");
  }
}
