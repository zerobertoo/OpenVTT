import type { ActorDto, DrawingDto, FloorDto, HandoutDto, LightDto, SceneDto, TokenDto } from "@openvtt/shared";
import { api } from "../api";
import { toastActionFailure } from "./actionFailure";
import type { UndoEntry } from "./undo";

export interface Move {
  tokenId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

type NewDrawing = Pick<DrawingDto, "kind" | "layer" | "points" | "color" | "text">;
/** A light as the server takes it: the stored one without its id (ids are reissued on every save). */
export type LightInput = Omit<LightDto, "id">;
export const withoutId = ({ id: _id, ...light }: LightDto): LightInput => light;
const ignore = () => undefined;

/**
 * Table changes that the game master can undo. `record` is a no-op for players. Every step is sent to the
 * server like any other change, so permissions and hidden data rules still apply.
 */
export function undoableActions(
  worldId: string,
  move: (tokenId: string, x: number, y: number) => void,
  record: (entry: UndoEntry) => () => void,
) {
  // Tokens and drawings recreated by undo get new ids; this keeps the chain of later steps pointing at them.
  const ids = new Map<string, string>();
  const current = (id: string) => {
    let latest = id;
    while (ids.has(latest)) latest = ids.get(latest) as string;
    return latest;
  };
  // Remembers that the record now living under `id` was recreated with a new id.
  const remember = (id: string, recreatedAs: string) => ids.set(current(id), recreatedAs);
  // Steps run one after another, so an undo never acts on an id the server has not returned yet.
  let queue: Promise<unknown> = Promise.resolve();
  const run = <T>(step: () => Promise<T>) => {
    const next = queue.then(step);
    queue = next.catch(ignore);
    return next;
  };
  const apply = (step: () => Promise<unknown>, entry: UndoEntry) => {
    // Recorded right away so an immediate undo works; the queue makes that undo wait for this step's outcome.
    let refused = false;
    const unlessRefused = (direction: () => Promise<unknown>) => () => run(() => (refused ? Promise.resolve() : direction()));
    const forget = record({ undo: unlessRefused(entry.undo), redo: unlessRefused(entry.redo) });
    void run(step).catch((error) => {
      refused = true;
      forget();
      toastActionFailure(error);
    });
  };
  // Like `apply` for a change sent per item: undo and redo cover only the items the server accepted.
  const applyToEach = <T>(items: T[], change: (item: T) => Promise<unknown>, undoItem: (item: T) => Promise<unknown>) => {
    let accepted = items;
    const forAccepted = (act: (item: T) => Promise<unknown>) => () => Promise.all(accepted.map(act));
    const step = async () => {
      const results = await Promise.allSettled(items.map(change));
      accepted = items.filter((_, index) => results[index]?.status === "fulfilled");
      const failure = results.find((result) => result.status === "rejected");
      if (!failure) return;
      if (accepted.length === 0) throw failure.reason;
      toastActionFailure(failure.reason);
    };
    apply(step, { undo: forAccepted(undoItem), redo: forAccepted(change) });
  };

  const createToken = async (token: TokenDto) => {
    const { rotation, id: _id, ...fields } = token;
    const created = await api.createToken(worldId, fields);
    if (rotation) await api.updateToken(created.id, { rotation });
    remember(token.id, created.id);
    return created;
  };

  const createHandout = async (handout: HandoutDto) => {
    const { title, body, audience } = handout;
    remember(handout.id, (await api.createHandout(worldId, { title, body, audience })).id);
  };

  const createActor = async (actor: ActorDto, linkedTokenIds: string[]) => {
    const created = await api.createActor(worldId, actor.name, actor.type);
    remember(actor.id, created.id);
    await api.updateActor(created.id, { data: actor.data, ownerId: actor.ownerId });
    for (const tokenId of linkedTokenIds) await api.updateToken(current(tokenId), { actorId: created.id });
  };

  // Saves a partial update and, only once the server took it, records a step that puts the same fields back.
  const saveChange = async (
    id: string,
    snapshot: Record<string, unknown>,
    changes: Record<string, unknown>,
    send: (id: string, body: object) => Promise<unknown>,
  ) => {
    const changed = Object.keys(changes).filter((key) => JSON.stringify(snapshot[key]) !== JSON.stringify(changes[key]));
    if (changed.length === 0) return;
    const pick = (from: Record<string, unknown>) => Object.fromEntries(changed.map((key) => [key, from[key]]));
    const before = pick(snapshot);
    const after = pick(changes);
    await run(() => send(current(id), after));
    record({ undo: () => run(() => send(current(id), before)), redo: () => run(() => send(current(id), after)) });
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

    /**
     * Records an edit the caller already saved (a sheet field, a handout): undo sends `before` and redo sends `after`
     * through `send`, so the server checks them like any other edit. `send` gets the record's current id.
     */
    edited(id: string, send: (id: string, body: object) => Promise<unknown>, before: object, after: object) {
      record({ undo: () => run(() => send(current(id), before)), redo: () => run(() => send(current(id), after)) });
    },

    /** A token the caller already created from the panel: undo deletes it and redo makes it again. */
    tokenCreated(token: TokenDto) {
      record({ undo: () => run(() => api.deleteToken(current(token.id))), redo: () => run(() => createToken(token)) });
    },

    handoutCreated(handout: HandoutDto) {
      record({ undo: () => run(() => api.deleteHandout(current(handout.id))), redo: () => run(() => createHandout(handout)) });
    },

    /** The caller already deleted the handout; undo writes it again (with a new id that later steps follow). */
    handoutDeleted(handout: HandoutDto) {
      record({ undo: () => run(() => createHandout(handout)), redo: () => run(() => api.deleteHandout(current(handout.id))) });
    },

    actorCreated(actor: ActorDto) {
      record({ undo: () => run(() => api.deleteActor(current(actor.id))), redo: () => run(() => createActor(actor, [])) });
    },

    /** The caller already deleted the sheet; undo writes it again and links back the tokens that used it. */
    actorDeleted(actor: ActorDto, linkedTokenIds: string[]) {
      record({ undo: () => run(() => createActor(actor, linkedTokenIds)), redo: () => run(() => api.deleteActor(current(actor.id))) });
    },

    moveTokens(targets: { token: TokenDto; x: number; y: number }[]) {
      for (const { token, x, y } of targets) move(token.id, x, y);
      moved(targets.map(({ token, x, y }) => ({ tokenId: token.id, from: { x: token.x, y: token.y }, to: { x, y } })));
    },

    rotate(tokens: TokenDto[], degrees: number) {
      const turn = (by: number) => (t: TokenDto) => api.updateToken(current(t.id), { rotation: (((t.rotation + by) % 360) + 360) % 360 });
      applyToEach(tokens, turn(degrees), turn(0));
    },

    remove(tokens: TokenDto[]) {
      applyToEach(tokens, (t) => api.deleteToken(current(t.id)), createToken);
    },

    draw(sceneId: string, floorId: string, drawing: NewDrawing) {
      const key = crypto.randomUUID();
      const make = async () => remember(key, (await api.createDrawing(sceneId, { ...drawing, floorId })).id);
      apply(make, { undo: () => api.deleteDrawing(current(key)), redo: make });
    },

    erase(sceneId: string, floorId: string, drawing: DrawingDto) {
      const { kind, layer, points, color, text } = drawing;
      apply(() => api.deleteDrawing(drawing.id), {
        undo: async () => remember(drawing.id, (await api.createDrawing(sceneId, { kind, layer, points, color, text, floorId })).id),
        redo: () => api.deleteDrawing(current(drawing.id)),
      });
    },

    /**
     * Edits a token (name, health, conditions, visibility...). Resolves once the server accepted it and rejects when it did
     * not, so the panel can show the error. Undo puts back the values of the fields that really changed.
     */
    changeToken(token: TokenDto, changes: Record<string, unknown>) {
      return saveChange(token.id, token as unknown as Record<string, unknown>, changes, api.updateToken);
    },

    /** Changes scene settings, like `changeToken`: nothing is sent or recorded when no value differs. */
    changeScene(scene: SceneDto, changes: Record<string, unknown>) {
      return saveChange(scene.id, scene as unknown as Record<string, unknown>, changes, api.updateScene);
    },

    /** Renames a floor; undo puts the old name back. */
    renameFloor(floor: Pick<FloorDto, "id" | "name">, name: string) {
      const set = (value: string) => () => api.updateFloor(current(floor.id), { name: value });
      apply(set(name), { undo: set(floor.name), redo: set(name) });
    },

    /** Replaces the lights of a floor (place, edit, move, remove); undo puts the previous list back. */
    changeLights(floor: Pick<FloorDto, "id" | "lights">, next: LightInput[]) {
      const set = (lights: LightInput[]) => () => api.updateFloor(current(floor.id), { lights });
      apply(set(next), { undo: set(floor.lights.map(withoutId)), redo: set(next) });
    },

    /** Adds a floor on top; undo deletes it again, and redo adds it back with the same background. */
    addFloor(sceneId: string, input: { name: string; assetId: string | null }) {
      const key = crypto.randomUUID();
      const make = async () => remember(key, (await api.createFloor(sceneId, input)).floors.at(-1)!.id);
      apply(make, { undo: () => api.deleteFloor(current(key)), redo: make });
    },

    place(entryId: string, sceneId: string, floorId: string, x: number, y: number, locale?: string) {
      const key = crypto.randomUUID();
      const put = async () => remember(key, (await api.placeCompendium(worldId, entryId, { sceneId, floorId, x, y, locale })).id);
      apply(put, { undo: () => api.deleteToken(current(key)), redo: put });
    },
  };
}

export type TableActions = ReturnType<typeof undoableActions>;
