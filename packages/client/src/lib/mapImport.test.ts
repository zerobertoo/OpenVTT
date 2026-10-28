import { describe, expect, it, vi } from "vitest";
import { MapImportError, parseGridFromName, prepareMapImport } from "./mapImport";

vi.mock("./media", () => ({ readMediaSize: async () => ({ width: 1484, height: 2014 }) }));

const uvttText = JSON.stringify({
  resolution: { map_size: { x: 28, y: 38 }, pixels_per_grid: 53 },
  lights: [{ position: { x: 1, y: 1 }, range: 5 }],
  image: "",
});

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

describe("prepareMapImport", () => {
  it("pairs a Universal VTT file with its sibling video (video exports carry no picture)", async () => {
    const draft = await prepareMapImport([
      new File([uvttText], "Little Oasis.dd2vtt"),
      new File(["v"], "Little Oasis.mp4", { type: "video/mp4" }),
    ]);
    expect(draft).toMatchObject({ name: "Little Oasis", gridSize: 53, mediaIsVideo: true, width: 1484, height: 2014 });
    expect(draft.uvtt?.lights).toHaveLength(1);
    expect(draft.warnings).toEqual(["no_walls"]);
  });

  it("uses the grid in the file name for a plain picture, and says when it had to guess", async () => {
    const named = await prepareMapImport([new File(["x"], "map_28x38.png", { type: "image/png" })]);
    expect(named.gridSize).toBe(53);
    expect(named.warnings).toEqual([]);
    const unnamed = await prepareMapImport([new File(["x"], "map.png", { type: "image/png" })]);
    expect(unnamed).toMatchObject({ gridSize: 70, warnings: ["grid_guessed"] });
  });

  it("explains what is wrong with the files", async () => {
    await expect(prepareMapImport([new File(["x"], "notes.txt")])).rejects.toMatchObject({ code: "unsupported_file" });
    await expect(prepareMapImport([new File([uvttText], "a.dd2vtt")])).rejects.toMatchObject({ code: "no_media" });
    await expect(prepareMapImport([new File(["nope"], "a.dd2vtt")])).rejects.toBeInstanceOf(MapImportError);
  });
});
