import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("forgetting a step the server refused", () => {
  const entry = (log: string[], name: string) => ({
    undo: async () => void log.push(`undo ${name}`),
    redo: async () => void log.push(`redo ${name}`),
  });

  it("brings back what could be redone before that step", async () => {
    const log: string[] = [];
    const { record, undo, redo } = useUndo.getState();
    record(entry(log, "a"));
    await undo();
    const forget = record(entry(log, "refused"));
    expect(useUndo.getState().future).toHaveLength(0);
    forget();
    await redo();
    expect(log).toEqual(["undo a", "redo a"]);
  });

  it("does the same when the step was already undone while it was pending", async () => {
    const log: string[] = [];
    const { record, undo, redo } = useUndo.getState();
    record(entry(log, "a"));
    await undo();
    const forget = record(entry(log, "refused"));
    await undo();
    forget();
    await redo();
    expect(log).toEqual(["undo a", "undo refused", "redo a"]);
  });

  it("keeps the redo history gone when a newer change has replaced it", async () => {
    const log: string[] = [];
    const { record, undo, redo } = useUndo.getState();
    record(entry(log, "a"));
    await undo();
    const forget = record(entry(log, "refused"));
    record(entry(log, "newer"));
    forget();
    expect(await redo()).toBe(false);
    expect(useUndo.getState().past).toHaveLength(1);
  });
});
