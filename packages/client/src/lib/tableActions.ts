import type { DrawingDto, TokenDto } from "@openvtt/shared";
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
  const current = (id: string) => ids.get(id) ?? id;

  const createToken = async (token: TokenDto) => {
    const { rotation, id: _id, ...fields } = token;
    const created = await api.createToken(worldId, fields);
    if (rotation) await api.updateToken(created.id, { rotation });
    ids.set(token.id, created.id);
    return created;
  };

  return {
    moved(moves: Move[]) {
      if (moves.length === 0) return;
      const go = (to: "from" | "to") => async () => {
        for (const m of moves) move(current(m.tokenId), m[to].x, m[to].y);
      };
      record({ undo: go("from"), redo: go("to") });
    },

    moveToken(token: TokenDto, x: number, y: number) {
      move(token.id, x, y);
      this.moved([{ tokenId: token.id, from: { x: token.x, y: token.y }, to: { x, y } }]);
    },

    rotate(tokens: TokenDto[], degrees: number) {
      const turn = (by: number) => () =>
        Promise.all(tokens.map((t) => api.updateToken(current(t.id), { rotation: (((t.rotation + by) % 360) + 360) % 360 })));
      void turn(degrees)().catch(ignore);
      record({ undo: turn(0), redo: turn(degrees) });
    },

    remove(tokens: TokenDto[]) {
      const drop = () => Promise.all(tokens.map((t) => api.deleteToken(current(t.id))));
      void drop().catch(ignore);
      record({ undo: () => Promise.all(tokens.map(createToken)), redo: drop });
    },

    draw(sceneId: string, drawing: NewDrawing) {
      const key = crypto.randomUUID();
      const make = async () => ids.set(key, (await api.createDrawing(sceneId, drawing)).id);
      void make().catch(ignore);
      record({ undo: () => api.deleteDrawing(current(key)), redo: make });
    },

    erase(sceneId: string, drawing: DrawingDto) {
      const { kind, layer, points, color, text } = drawing;
      void api.deleteDrawing(drawing.id).catch(ignore);
      record({
        undo: async () => ids.set(drawing.id, (await api.createDrawing(sceneId, { kind, layer, points, color, text })).id),
        redo: () => api.deleteDrawing(current(drawing.id)),
      });
    },

    place(entryId: string, sceneId: string, x: number, y: number) {
      const key = crypto.randomUUID();
      const put = async () => ids.set(key, (await api.placeCompendium(worldId, entryId, { sceneId, x, y })).id);
      void put().catch(ignore);
      record({ undo: () => api.deleteToken(current(key)), redo: put });
    },
  };
}
