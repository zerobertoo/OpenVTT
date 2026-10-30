import { describe, expect, it } from "vitest";
import { actionForKey, isTypingTarget } from "./shortcuts";

const press = (key: string, modifiers: Partial<Record<"ctrlKey" | "metaKey" | "altKey", boolean>> = {}) =>
  actionForKey({ key, ctrlKey: false, metaKey: false, altKey: false, ...modifiers });

describe("actionForKey", () => {
  it("maps tool, panel and help keys, in either letter case", () => {
    expect(press("v")).toEqual({ type: "tool", tool: "select" });
    expect(press("R")).toEqual({ type: "tool", tool: "ruler" });
    expect(press("p")).toEqual({ type: "togglePanels" });
    expect(press("D")).toEqual({ type: "diceTray" });
    expect(press("m")).toEqual({ type: "minimap" });
    expect(press("?")).toEqual({ type: "help" });
    expect(press("Escape")).toEqual({ type: "deselect" });
  });

  it("maps the zoom keys, with and without shift", () => {
    expect(press("+")).toEqual({ type: "view", kind: "zoomIn" });
    expect(press("=")).toEqual({ type: "view", kind: "zoomIn" });
    expect(press("-")).toEqual({ type: "view", kind: "zoomOut" });
    expect(press("0")).toEqual({ type: "view", kind: "fit" });
    expect(press("c")).toEqual({ type: "view", kind: "center" });
  });

  it("turns arrow keys into one-cell moves", () => {
    expect(press("ArrowLeft")).toEqual({ type: "move", dx: -1, dy: 0 });
    expect(press("ArrowDown")).toEqual({ type: "move", dx: 0, dy: 1 });
  });

  it("maps turning and deleting the selection", () => {
    expect(press("[")).toEqual({ type: "rotate", degrees: -45 });
    expect(press("]")).toEqual({ type: "rotate", degrees: 45 });
    expect(press("Delete")).toEqual({ type: "remove" });
  });

  it("leaves browser shortcuts and unknown keys alone", () => {
    expect(press("r", { ctrlKey: true })).toBeNull();
    expect(press("p", { metaKey: true })).toBeNull();
    expect(press("x")).toBeNull();
  });
});

describe("isTypingTarget", () => {
  const make = (html: string) => {
    document.body.innerHTML = html;
    return document.body.firstElementChild;
  };

  it("keeps the keyboard for fields, tabs and sliders", () => {
    expect(isTypingTarget(make("<input />"))).toBe(true);
    expect(isTypingTarget(make("<textarea></textarea>"))).toBe(true);
    expect(isTypingTarget(make('<button role="tab">Chat</button>'))).toBe(true);
    expect(isTypingTarget(make('<div role="slider" tabindex="0"></div>'))).toBe(true);
  });

  it("keeps the keyboard for anything inside a dialog", () => {
    document.body.innerHTML = '<div role="dialog"><button id="b">OK</button></div>';
    expect(isTypingTarget(document.getElementById("b"))).toBe(true);
  });

  it("lets the table have it otherwise", () => {
    expect(isTypingTarget(make("<main></main>"))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
