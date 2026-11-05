import { beforeEach, expect, it, vi } from "vitest";
import { toastActionFailure } from "./actionFailure";
import { useUndo } from "./undo";

vi.mock("./actionFailure", () => ({ toastActionFailure: vi.fn() }));

beforeEach(() => useUndo.getState().clear());

it("reports a failed undo and moves on, so one lost record cannot block older steps", async () => {
  const refusal = new Error("gone");
  const { record, undo } = useUndo.getState();
  const older = vi.fn().mockResolvedValue(undefined);
  record({ undo: older, redo: vi.fn() });
  record({ undo: vi.fn().mockRejectedValue(refusal), redo: vi.fn() });
  await undo();
  expect(toastActionFailure).toHaveBeenCalledWith(refusal);
  await undo();
  expect(older).toHaveBeenCalled();
});

it("undoes and redoes in order, and a new change drops what could be redone", async () => {
  const log: string[] = [];
  const entry = (name: string) => ({ undo: async () => log.push(`undo ${name}`), redo: async () => log.push(`redo ${name}`) });
  const { record, undo, redo } = useUndo.getState();
  record(entry("a"));
  record(entry("b"));
  await undo();
  await undo();
  expect(await undo()).toBe(false);
  await redo();
  record(entry("c"));
  expect(await redo()).toBe(false);
  expect(log).toEqual(["undo b", "undo a", "redo a"]);
  expect(useUndo.getState().past).toHaveLength(2);
});
