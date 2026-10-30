# Roadmap

What is built, and what is still planned. Nothing here is a promise or a date; it records what was decided so it is not lost.

## Built

**Maps**

- Scenes from images, animated videos (WebM, MP4), Universal VTT files (`.dd2vtt`, `.uvtt`), Foundry-style scene JSON and images with the grid in the file name; several floors of one map imported together.
- Square and hex grids (pointy or flat top), adjusted visually over the map; distances in metric, imperial or the scene's own units.
- Walls, doors and lights, drawn for the game master; tokens cannot walk through walls or closed doors.
- Fog of war from vision computed on the server (players only receive what their tokens see), and "view as player" for the game master.
- Export of a scene as Universal VTT.
- Drawings, arrows, shapes, text and private note pins for the game master.
- Map layers (background, objects, tokens, game master only) that can be hidden and locked.
- Ruler with line, circle, cone and rectangle shapes and diagonal rules; ping and "look here"; overview map.

**Tokens and play**

- Tokens with pictures, health bars, conditions and names; multi-select with box or Shift+click, batch turn and delete; many images imported as tokens at once.
- Initiative order with turns and rounds, hidden tokens left out for players, and a "your turn" chime and notice.
- Chat with rolls (`/r`, `/gr`), whispers (`/w`), advantage and disadvantage, roll again, history with the arrow keys; dice tray and 2D or 3D dice over the table.
- Character and NPC sheets defined by rules-system packages; a compendium of monsters and items per system, dragged onto the map.
- Journal of markdown handouts shared with chosen players; a library of the world's uploads.
- Table music from uploaded MP3 or Ogg files, with a volume per person.
- Undo and redo of the game master's map changes (moves, turns, deletions, drawings, compendium placements).

**People and data**

- Roles: game master, assistant game master, player and observer; invites that expire or allow a number of uses; mute and remove members; a log of game master actions.
- World export and import as one zip; session log download in markdown, per reader.
- Scheduled database copies inside the server and documented restore steps.

**Interface**

- Keyboard shortcuts for everything on the table (`?` lists them), focus mode, a map-only TV view, resizable side panels, touch gestures.
- English and Brazilian Portuguese; high contrast, larger text and accent color choices; first-session tour.
- Performance: off-screen culling on the map, a capped texture cache, no drawing in hidden tabs, a virtualized chat.

## Planned or open

- **Undo coverage.** Undo covers map changes made from the map (moves, turns, deletions, drawings, compendium). Scene settings, walls edited in bulk, sheets and handouts are not undoable yet.
- **Compendium.** Only the D&D 5e SRD package ships entries, and only a small set. Items are tokens without a sheet; a richer item model (inventory on sheets) would need a template field for it.
- **Map import.** Fantasy Grounds XML, AboveVTT and Roll20 JSON are not supported (no public specifications); revisit with samples and public docs. Wall and door shapes of Dungeon Alchemist exports are still unverified against real files with walls.
- **3D dice physics** beyond the current throw, and token animations beyond the first pass.
- **Client architecture.** Revisit TanStack Router lazy routes once the sign-in bundle nears its budget again (it is close: about 213 of 215 KB gzip).

Not planned: auras (until systems give tokens ranges), macros and a hotbar (revisit with the compendium), print or PDF sheets beyond the browser's print stylesheet, scene transitions.
