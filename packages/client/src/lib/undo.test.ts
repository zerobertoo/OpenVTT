import { expect, it } from "vitest";
import { useUndo } from "./undo";

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
