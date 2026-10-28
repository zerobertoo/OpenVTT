import type { CombatDto } from "@openvtt/shared";
import type { Db } from "./db.ts";
import { AppError } from "./errors.ts";
import type { Viewer } from "./tokens.ts";

interface CombatantRow {
  token_id: string;
  name: string;
  score: number;
  hidden: number;
}

/** Initiative order: one combat per world, made of tokens with a score. Only the game master changes it. */
export class CombatService {
  constructor(private db: Db) {}

  private rows(worldId: string): CombatantRow[] {
    return this.db
      .prepare(
        `SELECT c.token_id, t.name, c.score, t.hidden FROM combatants c JOIN tokens t ON t.id = c.token_id
         WHERE c.world_id = ? ORDER BY c.score DESC, c.rowid`,
      )
      .all(worldId) as unknown as CombatantRow[];
  }

  isCombatant(tokenId: string): boolean {
    return !!this.db.prepare("SELECT 1 AS ok FROM combatants WHERE token_id = ?").get(tokenId);
  }

  /** What the viewer may know: players never get a hidden token's name, score or turn. */
  stateFor(worldId: string, viewer: Viewer): CombatDto | null {
    const combat = this.db.prepare("SELECT round, turn_token_id FROM combats WHERE world_id = ?").get(worldId) as
      | { round: number; turn_token_id: string | null }
      | undefined;
    if (!combat) return null;
    const shown = this.rows(worldId).filter((r) => viewer.role === "gm" || r.hidden === 0);
    const turn = shown.some((r) => r.token_id === combat.turn_token_id) ? combat.turn_token_id : null;
    return {
      round: combat.round,
      turnTokenId: turn,
      combatants: shown.map((r) => ({ tokenId: r.token_id, name: r.name, score: r.score })),
    };
  }

  /** Adds a token to the order (starting the combat if needed) or changes its score. */
  setCombatant(worldId: string, tokenId: string, score: number) {
    const token = this.db
      .prepare("SELECT 1 AS ok FROM tokens t JOIN scenes s ON s.id = t.scene_id WHERE t.id = ? AND s.world_id = ?")
      .get(tokenId, worldId);
    if (!token) throw new AppError("not_found");
    this.db.prepare("INSERT OR IGNORE INTO combats (world_id) VALUES (?)").run(worldId);
    this.db
      .prepare("INSERT INTO combatants (token_id, world_id, score) VALUES (?, ?, ?) ON CONFLICT(token_id) DO UPDATE SET score = excluded.score")
      .run(tokenId, worldId, score);
  }

  removeCombatant(worldId: string, tokenId: string) {
    this.db.prepare("DELETE FROM combatants WHERE token_id = ? AND world_id = ?").run(tokenId, worldId);
    const combat = this.db.prepare("SELECT turn_token_id FROM combats WHERE world_id = ?").get(worldId) as { turn_token_id: string | null } | undefined;
    // The turn of a removed token passes on instead of dangling.
    if (combat?.turn_token_id === tokenId) this.db.prepare("UPDATE combats SET turn_token_id = NULL WHERE world_id = ?").run(worldId);
  }

  /** Moves the turn to the next combatant; coming back to the top of the order starts a new round. */
  nextTurn(worldId: string) {
    const combat = this.db.prepare("SELECT round, turn_token_id FROM combats WHERE world_id = ?").get(worldId) as
      | { round: number; turn_token_id: string | null }
      | undefined;
    const order = this.rows(worldId);
    if (!combat || order.length === 0) throw new AppError("not_found");
    const current = order.findIndex((r) => r.token_id === combat.turn_token_id);
    const next = (current + 1) % order.length;
    const round = current >= 0 && next === 0 ? combat.round + 1 : combat.round;
    this.db.prepare("UPDATE combats SET round = ?, turn_token_id = ? WHERE world_id = ?").run(round, order[next]!.token_id, worldId);
  }

  end(worldId: string) {
    this.db.prepare("DELETE FROM combatants WHERE world_id = ?").run(worldId);
    this.db.prepare("DELETE FROM combats WHERE world_id = ?").run(worldId);
  }
}
