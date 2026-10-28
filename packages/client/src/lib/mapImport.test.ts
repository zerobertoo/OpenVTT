import { describe, expect, it, vi } from "vitest";
import { MapImportError, parseGridFromName, prepareMapImports } from "./mapImport";

vi.mock("./media", () => ({ readMediaSize: async () => ({ width: 1484, height: 2014 }) }));

const uvttText = JSON.stringify({
  resolution: { map_size: { x: 28, y: 38 }, pixels_per_grid: 53 },
  lights: [{ position: { x: 1, y: 1 }, range: 5 }],
  image: "",
});
const foundryText = JSON.stringify({
  name: "Oasis",
  width: 1484,
  height: 2014,
  grid: 53,
  gridDistance: 5,
  gridUnits: "ft",
  lights: [{ x: 10, y: 10, dim: 25 }],
  walls: [{ c: [0, 0, 100, 0] }],
});
const video = (name: string) => new File(["v"], name, { type: "video/mp4" });

describe("parseGridFromName", () => {
  it("reads columns x rows when they split the picture into square cells", () => {
    expect(parseGridFromName("map_28x38.png", 1484, 2014)).toBe(53);
    expect(parseGridFromName("Crypt 28 x 38 grid.jpg", 1484, 2014)).toBe(53);
  });

  it("ignores numbers that do not fit the picture", () => {
    expect(parseGridFromName("map_30x20.png", 1484, 2014)).toBeNull();
    expect(parseGridFromName("1920x1080 wallpaper.png", 1484, 2014)).toBeNull();
    expect(parseGridFromName("plain.png", 1484, 2014)).toBeNull();
  });
});

describe("prepareMapImports", () => {
  it("pairs a Universal VTT file with its sibling video (video exports carry no picture)", async () => {
    const [draft, ...rest] = await prepareMapImports([new File([uvttText], "Little Oasis.dd2vtt"), video("Little Oasis.mp4")]);
    expect(rest).toHaveLength(0);
    expect(draft).toMatchObject({ name: "Little Oasis", gridSize: 53, mediaIsVideo: true, width: 1484, height: 2014 });
    expect(draft?.data?.lights).toHaveLength(1);
    expect(draft?.warnings).toEqual(["no_walls"]);
  });

  it("reads a Foundry-style JSON with its picture, including the distance per cell", async () => {
    const [draft] = await prepareMapImports([new File([foundryText], "Oasis.json"), video("Oasis.mp4")]);
    expect(draft).toMatchObject({ gridSize: 53, gridDistance: 5, distanceUnit: "ft" });
    expect(draft?.data?.walls).toHaveLength(1);
  });

  it("uses the grid in the file name for a plain picture, and says when it had to guess", async () => {
    const [named] = await prepareMapImports([new File(["x"], "map_28x38.png", { type: "image/png" })]);
    expect(named).toMatchObject({ gridSize: 53, warnings: [] });
    const [unnamed] = await prepareMapImports([new File(["x"], "map.png", { type: "image/png" })]);
    expect(unnamed).toMatchObject({ gridSize: 70, warnings: ["grid_guessed"] });
  });

  it("groups files named Name_0, Name_1 as floors of one map, in order", async () => {
    const drafts = await prepareMapImports([
      video("Tavern_1.mp4"),
      new File([foundryText], "Tavern_1.json"),
      video("Tavern_0.mp4"),
      new File([foundryText], "Tavern_0.json"),
      video("Cellar.mp4"),
    ]);
    const floors = drafts.filter((d) => d.floorKey === "tavern");
    expect(floors.map((d) => d.floor)).toEqual([0, 1]);
    expect(drafts.find((d) => d.name === "Cellar")?.floorKey).toBeNull();
  });

  it("explains what is wrong with the files", async () => {
    await expect(prepareMapImports([new File(["x"], "notes.txt")])).rejects.toMatchObject({ code: "unsupported_file" });
    await expect(prepareMapImports([new File([uvttText], "a.dd2vtt")])).rejects.toMatchObject({ code: "no_media" });
    await expect(prepareMapImports([new File(["nope"], "a.dd2vtt")])).rejects.toBeInstanceOf(MapImportError);
    await expect(prepareMapImports([new File(["{}"], "a.json"), video("a.mp4")])).rejects.toMatchObject({ code: "not_uvtt" });
  });
});
