import type { DrawingDto, SceneDto, TokenDto } from "@openvtt/shared";
import { api } from "../api";
import type { UndoEntry } from "./undo";

export interface Move {
  tokenId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

type NewDrawing = Pick<DrawingDto, "kind" | "layer" | "points" | "color" | "text">;
const ignore = () => undefined;

/**
 * Table changes that the game master can undo. `record` is a no-op for players. Every step is sent to the
 * server like any other change, so permissions and hidden data rules still apply.
 */
export function undoableActions(
  worldId: string,
  move: (tokenId: string, x: number, y: number) => void,
  record: (entry: UndoEntry) => void,
) {
  // Tokens and drawings recreated by undo get new ids; this keeps the chain of later steps pointing at them.
  const ids = new Map<string, string>();
  const current = (id: string) => {
    let latest = id;
    while (ids.has(latest)) latest = ids.get(latest) as string;
    return latest;
  };
  // Steps run one after another, so an undo never acts on an id the server has not returned yet.
  let queue: Promise<unknown> = Promise.resolve();
  const run = <T>(step: () => Promise<T>) => {
    const next = queue.then(step);
    queue = next.catch(ignore);
    return next;
  };
  const apply = (step: () => Promise<unknown>, entry: UndoEntry) => {
    void run(step).catch(ignore);
    record({ undo: () => run(entry.undo), redo: () => run(entry.redo) });
  };

  const createToken = async (token: TokenDto) => {
    const { rotation, id: _id, ...fields } = token;
    const created = await api.createToken(worldId, fields);
    if (rotation) await api.updateToken(created.id, { rotation });
    ids.set(token.id, created.id);
    return created;
  };

  const moved = (moves: Move[]) => {
    if (moves.length === 0) return;
    const go = (to: "from" | "to") => async () => {
      for (const m of moves) move(current(m.tokenId), m[to].x, m[to].y);
    };
    record({ undo: () => run(go("from")), redo: () => run(go("to")) });
  };

  return {
    moved,

    moveTokens(targets: { token: TokenDto; x: number; y: number }[]) {
      for (const { token, x, y } of targets) move(token.id, x, y);
      moved(targets.map(({ token, x, y }) => ({ tokenId: token.id, from: { x: token.x, y: token.y }, to: { x, y } })));
    },

    rotate(tokens: TokenDto[], degrees: number) {
      const turn = (by: number) => () =>
        Promise.all(tokens.map((t) => api.updateToken(current(t.id), { rotation: (((t.rotation + by) % 360) + 360) % 360 })));
      apply(turn(degrees), { undo: turn(0), redo: turn(degrees) });
    },

    remove(tokens: TokenDto[]) {
      const drop = () => Promise.all(tokens.map((t) => api.deleteToken(current(t.id))));
      apply(drop, { undo: () => Promise.all(tokens.map(createToken)), redo: drop });
    },

    draw(sceneId: string, floorId: string, drawing: NewDrawing) {
      const key = crypto.randomUUID();
      const make = async () => ids.set(key, (await api.createDrawing(sceneId, { ...drawing, floorId })).id);
      apply(make, { undo: () => api.deleteDrawing(current(key)), redo: make });
    },

    erase(sceneId: string, floorId: string, drawing: DrawingDto) {
      const { kind, layer, points, color, text } = drawing;
      apply(() => api.deleteDrawing(drawing.id), {
        undo: async () => ids.set(drawing.id, (await api.createDrawing(sceneId, { kind, layer, points, color, text, floorId })).id),
        redo: () => api.deleteDrawing(current(drawing.id)),
      });
    },

    /** Edits a token (name, health, conditions, visibility...); undo puts back the values of the same fields. */
    changeToken(token: TokenDto, changes: Record<string, unknown>) {
      const before = Object.fromEntries(Object.keys(changes).map((key) => [key, (token as unknown as Record<string, unknown>)[key]]));
      const set = (values: object) => () => api.updateToken(current(token.id), values);
      apply(set(changes), { undo: set(before), redo: set(changes) });
    },

    /** Changes scene settings; undo puts back the values the scene had for the same fields. */
    changeScene(scene: SceneDto, changes: Record<string, unknown>) {
      const before = Object.fromEntries(Object.keys(changes).map((key) => [key, (scene as unknown as Record<string, unknown>)[key]]));
      const set = (values: object) => () => api.updateScene(scene.id, values);
      apply(set(changes), { undo: set(before), redo: set(changes) });
    },

    place(entryId: string, sceneId: string, x: number, y: number, locale?: string) {
      const key = crypto.randomUUID();
      const put = async () => ids.set(key, (await api.placeCompendium(worldId, entryId, { sceneId, x, y, locale })).id);
      apply(put, { undo: () => api.deleteToken(current(key)), redo: put });
    },
  };
}
