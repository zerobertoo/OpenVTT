import type { DrawingDto } from "@openvtt/shared";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "../api";
import { undoableActions } from "./tableActions";
import { useUndo } from "./undo";

vi.mock("../api", () => ({
  api: {
    createDrawing: vi.fn(),
    deleteDrawing: vi.fn(),
    updateScene: vi.fn(),
    updateToken: vi.fn(),
    createActor: vi.fn(),
    updateActor: vi.fn(),
    deleteActor: vi.fn(),
    createHandout: vi.fn(),
    deleteHandout: vi.fn(),
  },
}));

const line: Pick<DrawingDto, "kind" | "layer" | "points" | "color" | "text"> = {
  kind: "line",
  layer: "objects",
  points: [0, 0, 10, 10],
  color: "#000000",
  text: "",
};
let next = 0;

beforeEach(() => {
  next = 0;
  useUndo.getState().clear();
  vi.mocked(api.deleteDrawing)
    .mockReset()
    .mockResolvedValue(undefined as never);
  vi.mocked(api.createDrawing)
    .mockReset()
    .mockImplementation(async () => ({ id: `d${++next}` }) as never);
});

const actions = () => undoableActions("w", vi.fn(), useUndo.getState().record);

it("follows ids through several recreations", async () => {
  const table = actions();
  table.draw("s", "f", line);
  await vi.waitFor(() => expect(api.createDrawing).toHaveBeenCalledTimes(1));
  table.erase("s", "f", { ...line, id: "d1", authorId: "u" } as never);
  await useUndo.getState().undo(); // the erase: the drawing comes back as d2
  await useUndo.getState().undo(); // the draw: d2 is the one to delete
  expect(vi.mocked(api.deleteDrawing).mock.calls.map(([id]) => id)).toEqual(["d1", "d2"]);
});

it("waits for the server's id before undoing a step made a moment ago", async () => {
  let respond: (value: { id: string }) => void = () => undefined;
  vi.mocked(api.createDrawing).mockImplementationOnce(() => new Promise((resolve) => (respond = resolve)) as never);
  actions().draw("s", "f", line);
  const undone = useUndo.getState().undo();
  await vi.waitFor(() => expect(api.createDrawing).toHaveBeenCalled());
  expect(api.deleteDrawing).not.toHaveBeenCalled();
  respond({ id: "slow" });
  await undone;
  expect(api.deleteDrawing).toHaveBeenCalledWith("slow");
});

it("puts scene settings back to what they were and applies them again on redo", async () => {
  vi.mocked(api.updateScene)
    .mockReset()
    .mockResolvedValue({} as never);
  actions().changeScene({ id: "s", gridSize: 70, gridType: "square" } as never, { gridSize: 100 });
  await vi.waitFor(() => expect(api.updateScene).toHaveBeenCalledWith("s", { gridSize: 100 }));
  await useUndo.getState().undo();
  expect(api.updateScene).toHaveBeenLastCalledWith("s", { gridSize: 70 });
  await useUndo.getState().redo();
  expect(api.updateScene).toHaveBeenLastCalledWith("s", { gridSize: 100 });
});

it("puts a token's edited fields back and edits the recreated token after an undone delete", async () => {
  vi.mocked(api.updateToken)
    .mockReset()
    .mockResolvedValue({} as never);
  actions().changeToken({ id: "t", name: "Orc", hp: 7 } as never, { hp: 3 });
  await vi.waitFor(() => expect(api.updateToken).toHaveBeenCalledWith("t", { hp: 3 }));
  await useUndo.getState().undo();
  expect(api.updateToken).toHaveBeenLastCalledWith("t", { hp: 7 });
  await useUndo.getState().redo();
  expect(api.updateToken).toHaveBeenLastCalledWith("t", { hp: 3 });
});

it("sends the saved edit's earlier values on undo and the new ones on redo", async () => {
  const send = vi.fn().mockResolvedValue(undefined);
  actions().edited("h", send, { title: "Old" }, { title: "New" });
  await useUndo.getState().undo();
  expect(send).toHaveBeenLastCalledWith("h", { title: "Old" });
  await useUndo.getState().redo();
  expect(send).toHaveBeenLastCalledWith("h", { title: "New" });
});

it("brings back a deleted sheet with its data and owner, links its tokens, and follows the new id", async () => {
  vi.mocked(api.createActor)
    .mockReset()
    .mockResolvedValue({ id: "a2" } as never);
  vi.mocked(api.updateActor)
    .mockReset()
    .mockResolvedValue({} as never);
  vi.mocked(api.updateToken)
    .mockReset()
    .mockResolvedValue({} as never);
  vi.mocked(api.deleteActor)
    .mockReset()
    .mockResolvedValue(undefined as never);
  const table = actions();
  table.actorDeleted({ id: "a1", name: "Orc", type: "npc", ownerId: "u", data: { hp: 3 } } as never, ["t1"]);
  await useUndo.getState().undo();
  expect(api.createActor).toHaveBeenCalledWith("w", "Orc", "npc");
  expect(api.updateActor).toHaveBeenCalledWith("a2", { data: { hp: 3 }, ownerId: "u" });
  expect(api.updateToken).toHaveBeenCalledWith("t1", { actorId: "a2" });
  await useUndo.getState().redo();
  expect(api.deleteActor).toHaveBeenCalledWith("a2");
});

it("deletes a handout made a moment ago on undo and writes it again on redo", async () => {
  vi.mocked(api.createHandout)
    .mockReset()
    .mockResolvedValue({ id: "h2" } as never);
  vi.mocked(api.deleteHandout)
    .mockReset()
    .mockResolvedValue(undefined as never);
  actions().handoutCreated({ id: "h1", title: "Map", body: "", audience: ["*"] });
  await useUndo.getState().undo();
  expect(api.deleteHandout).toHaveBeenCalledWith("h1");
  await useUndo.getState().redo();
  expect(api.createHandout).toHaveBeenCalledWith("w", { title: "Map", body: "", audience: ["*"] });
});
