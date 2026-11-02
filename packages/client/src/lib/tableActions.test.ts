import type { DrawingDto } from "@openvtt/shared";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "../api";
import { undoableActions } from "./tableActions";
import { useUndo } from "./undo";

vi.mock("../api", () => ({ api: { createDrawing: vi.fn(), deleteDrawing: vi.fn(), updateScene: vi.fn(), updateToken: vi.fn() } }));

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
  table.draw("s", line);
  await vi.waitFor(() => expect(api.createDrawing).toHaveBeenCalledTimes(1));
  table.erase("s", { ...line, id: "d1", authorId: "u" } as never);
  await useUndo.getState().undo(); // the erase: the drawing comes back as d2
  await useUndo.getState().undo(); // the draw: d2 is the one to delete
  expect(vi.mocked(api.deleteDrawing).mock.calls.map(([id]) => id)).toEqual(["d1", "d2"]);
});

it("waits for the server's id before undoing a step made a moment ago", async () => {
  let respond: (value: { id: string }) => void = () => undefined;
  vi.mocked(api.createDrawing).mockImplementationOnce(() => new Promise((resolve) => (respond = resolve)) as never);
  actions().draw("s", line);
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
