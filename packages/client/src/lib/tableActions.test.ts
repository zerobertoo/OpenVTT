import type { DrawingDto } from "@openvtt/shared";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "../api";
import { undoableActions } from "./tableActions";
import { useUndo } from "./undo";

vi.mock("../api", () => ({ api: { createDrawing: vi.fn(), deleteDrawing: vi.fn() } }));

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
  vi.mocked(api.deleteDrawing).mockReset().mockResolvedValue(undefined as never);
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
