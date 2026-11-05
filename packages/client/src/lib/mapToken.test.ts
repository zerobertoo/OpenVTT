import type { TokenDto } from "@openvtt/shared";
import { Container, Sprite, Text, Texture } from "pixi.js";
import { describe, expect, it } from "vitest";
import { drawTokenView } from "./mapToken";

const token = (overrides: Partial<TokenDto> = {}): TokenDto => ({
  id: "t1",
  sceneId: "s1",
  floorId: "f1",
  name: "goblin",
  x: 140,
  y: 70,
  size: 2,
  rotation: 90,
  color: "#3d6fd8",
  assetId: null,
  hidden: false,
  actorId: null,
  controllerIds: [],
  hp: null,
  hpMax: null,
  conditions: [],
  showName: false,
  ...overrides,
});
const noImage = async () => null;

describe("drawTokenView", () => {
  it("centres the view on the token and turns it by the token's rotation", () => {
    const view = new Container();
    drawTokenView(view, token(), 70, false, noImage);
    // A 2-cell token on a 70 px grid is 140 px wide: its centre is 70 px from its corner.
    expect([view.x, view.y]).toEqual([210, 140]);
    expect(view.rotation).toBeCloseTo(Math.PI / 2);
  });

  it("marks a hidden token for the game master and leaves a visible one plain", () => {
    const plain = new Container();
    const ghost = new Container();
    drawTokenView(plain, token(), 70, false, noImage);
    drawTokenView(ghost, token({ hidden: true }), 70, false, noImage);
    expect(ghost.children).toHaveLength(plain.children.length + 1);
  });

  it("shows the first two letters of the name, capitalised, when there is no picture", () => {
    const view = new Container();
    drawTokenView(view, token(), 70, false, noImage);
    const letters = view.children.find((c): c is Text => c instanceof Text);
    expect(letters?.text).toBe("GO");
  });

  it("draws the token afresh each time, discarding what was drawn before", () => {
    const view = new Container();
    drawTokenView(view, token(), 70, false, noImage);
    const first = [...view.children];
    drawTokenView(view, token({ name: "orc" }), 70, true, noImage);
    expect(first.every((child) => child.destroyed)).toBe(true);
    expect(view.children).toHaveLength(first.length);
  });

  it("adds the picture, masked to the token's circle and inset by its outline, once it has loaded", async () => {
    const view = new Container();
    const texture = Texture.EMPTY;
    drawTokenView(view, token({ assetId: "a1" }), 70, false, async (id) => (id === "a1" ? texture : null));
    expect(view.children.some((c) => c instanceof Sprite)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const sprite = view.children.find((c): c is Sprite => c instanceof Sprite);
    expect(sprite).toBeDefined();
    expect(sprite?.width).toBe(136);
    expect(sprite?.height).toBe(136);
    expect(sprite?.mask).toBeTruthy();
    // A token with a picture shows no initials.
    expect(view.children.some((c) => c instanceof Text)).toBe(false);
  });

  it("adds nothing when the picture fails to load or the view is gone by then", async () => {
    const failed = new Container();
    drawTokenView(failed, token({ assetId: "a1" }), 70, false, noImage);
    const gone = new Container();
    drawTokenView(gone, token({ assetId: "a1" }), 70, false, async () => Texture.EMPTY);
    gone.destroy({ children: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(failed.children.some((c) => c instanceof Sprite)).toBe(false);
    expect(gone.children).toHaveLength(0);
  });
});

describe("redrawing while the picture loads", () => {
  it("adds only the picture of the latest drawing", async () => {
    const view = new Container();
    const resolvers: ((texture: Texture) => void)[] = [];
    const slowLoad = () => new Promise<Texture>((resolve) => resolvers.push(resolve));
    drawTokenView(view, token({ assetId: "a1" }), 70, false, slowLoad);
    drawTokenView(view, token({ assetId: "a1" }), 70, true, slowLoad);
    for (const resolve of resolvers) resolve(Texture.EMPTY);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(view.children.filter((c) => c instanceof Sprite)).toHaveLength(1);
  });
});
