# Tutorial: importing a map

OpenVTT imports maps with their grid, walls, doors and lights, so fog of war works without redrawing anything. Supported inputs:

| You have | Choose | What you get |
|---|---|---|
| Dungeon Alchemist "UniversalVTT Export" (`.dd2vtt`) + image or video | best option | grid, walls, doors, lights, picture |
| Any tool's Universal VTT file (`.uvtt`) + picture | same | same |
| Foundry-style scene export (`.json`) + picture or video with the same name | works | what the file carries |
| Just a PNG, JPG, WebP, WebM or MP4 | plain import | picture only, no walls or lights |

## Exporting from Dungeon Alchemist

1. In the export dialog choose the format **UniversalVTT Export**.
2. **Turn the grid off** in the export: OpenVTT draws its own, and the one baked into the picture would double up.
3. For lighting that looks the same as in Dungeon Alchemist, choose "Render lights in image AND export to VTT".
4. For an animated map, pick the video file type (MP4 or WebM) and keep the `.dd2vtt` next to it. MP4 plays in the most browsers.
5. For several floors, export each floor on its own and name the files `Map_0`, `Map_1`, and so on.

The same advice is shown inside OpenVTT's import dialog.

## Importing

1. Open the **Scenes** tab and choose **Import map**.
2. In **Map files**, select the data file and the picture or video **together** (Ctrl or Shift to select several). Files named `Name_0`, `Name_1` become the floors of one scene.
3. OpenVTT reads the files and shows a summary: map size, number of walls, doors and lights, and **Things to check** warnings (for example no walls found, or the grid offset).
4. Review the cell size, then choose **Create scene**.

A picture without a data file can still carry its grid in the name: `map_28x38.png` means 28 columns by 38 rows, and the cell size is worked out from the picture. Otherwise set the **Cell size** by hand or use **Adjust grid on the map**.

## After importing

- Walls, doors and lights are visible to the game master only. Choose what is drawn from the **Layers** button on the map. Click a door's circle to open or close it.
- Show the scene to players with **Show to players**.
- Turn on **Fog of war** in the scene settings; see [tutorial-lighting-and-fog.md](tutorial-lighting-and-fog.md).
- Export a scene back out with **Export as Universal VTT** in its actions menu.

## Limits

A data file is read in the browser up to 100 MiB; a scene keeps up to 20,000 wall segments, 1,000 lights and 2,000 drawings; pictures are capped at 15 MiB and videos follow `OPENVTT_MAX_VIDEO_BYTES` ([configuration](configuration.md)). Grids shifted from the map corner are not supported yet. Fantasy Grounds, AboveVTT and Roll20 files are not supported.

Sample maps are not included in the repository. `e2e/import-map.spec.ts` builds a minimal valid `.dd2vtt` file you can copy from.
