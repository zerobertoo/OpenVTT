# Roadmap

Planned work that is not built yet. Nothing here is a promise or a date; it records what was decided so it is not lost.

## Map import and export

Goal: bring maps made in external tools into a scene with as little manual setup as possible, so a map from Dungeon Alchemist (or similar) arrives with its grid size and, later, its walls and lights.

Rule: formats are implemented from their public specifications or from sample files only. No code is copied from other virtual tabletops.

| Format | What it carries | Priority | Notes |
|---|---|---|---|
| Plain image (PNG, JPG, WebP) | Picture only | Done | Already supported when creating a scene. Grid size and distance are typed by hand. |
| Universal VTT (`.dd2vtt`, `.uvtt`) | Image, grid size in pixels, walls and doors (line of sight), lights | 1st | Common exchange format; exported by Dungeon Alchemist, Dungeondraft and others. Step 1 reads image and grid; step 2 stores walls, doors and lights on the scene. |
| Dungeon Alchemist export | Image and, depending on the export option, Universal VTT or a Foundry-style scene file | 1st | Covered by the two rows around it; verify the current export options against the tool before building. |
| Foundry-style scene JSON | Image reference, grid, walls, lights | 2nd | Public JSON shape. Read-only import, from sample files. |
| Image with grid in the file name or sidecar | Image plus a hint such as `map_30x20.png` | 3rd | Cheap fallback for packs that publish grid size in the name. |
| Export of an OpenVTT scene | Image, grid, walls, lights | 3rd | Export as Universal VTT so maps can leave as easily as they arrive. |

Planned steps:

1. **Import dialog in the Scenes tab.** Accept an image or a Universal VTT file, read grid size and distance, fill the new-scene form, let the game master confirm.
2. **Scene model.** Add optional walls, doors and lights to the scene data and to the world file format (`docs/world-file-format.md`).
3. **Walls on the map.** Draw walls and doors in the map view; block token movement and the ruler where it makes sense.
4. **Vision and lighting.** Per-player line of sight and light sources, using the imported walls and lights.
5. **Export** to Universal VTT.

Open questions:

- Maximum file size, since Universal VTT files embed the image as base64.
- Which Dungeon Alchemist export options to document for users.

## Client architecture

Decided direction, to be done after the visual redesign settles (separate commits):

- **TanStack Router** in place of the hand-written `usePath`: typed route params, and lazy-loaded routes so the table (PixiJS, `motion`) is not part of the login bundle.
- **TanStack Query** for REST data (worlds, systems, a world's system info) in place of ad-hoc `useEffect` fetches. The live table state keeps coming from the WebSocket hook, not from Query.
- Not planned: TanStack Start (the app is a self-hosted SPA served by the Fastify server), TanStack Form (forms are small and uncontrolled) and TanStack Table.
- Revisit TanStack Virtual if chat history gets long enough to need windowing.

## Interface

- 3D dice with physics for chat rolls (the current redesign ships animated dice without physics).
- Token and ruler animations in the map view beyond the first pass.
