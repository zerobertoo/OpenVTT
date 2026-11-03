# Plan: one map, several floors

Local planning note (not committed). Server stays the source of truth; hidden data never leaves it.

## Why

A Dungeon Alchemist export of a multi-level building (sample: `Downloads\maps+layers`, cellar / ground / upper / roof, all 32x42 squares at 48 px, same origin, opaque H.264 1536x2016 videos) is imported today as one scene per floor, tied only by a `floorGroup` label. The game master wants **one scene** whose floors they switch, with each player seeing the floor their own token is on.

Goals: one scene, N floors; per-floor background, walls, doors, lights and drawings; tokens belong to a floor; players only receive their own floor; one playing video at a time.
Non-goals: stacked see-through floors (the videos are opaque, so stacking is only a crossfade); players switching floors freely; floor-to-floor lighting or vision; Foundry/UVTT formats with floors (neither has them).
Anti-goal: leaking a hidden floor (its name, background asset id, walls, lights, drawings or tokens) to a player who is not on it.

## Decisions (yours)

- Model A: floors live inside the scene.
- Each player sees the floor of their own token. A player without a token, and observers, follow the scene's **table floor** (set by the game master).
- The game master gets a floor switcher and a "ghost" of the neighbouring floor (still frame, low opacity, game master only).
- No migration of existing floor groups (nobody uses them); `floorGroup` / `floor` on scenes are removed.

## Decisions (mine, say if you disagree)

- A scene row keeps grid, size, units, `baked_lighting`, vision settings and `locked_layers` (shared by every floor). New table `floors (id, scene_id, name, position, asset_id)`. `walls`, `lights`, `drawings` and `tokens` get `floor_id`. A SQL migration wraps every existing scene in one floor so existing databases keep working. "Layers" (background/objects/tokens/gm) keep their meaning; floors are always called floors.
- `SceneDto` = grid fields + `floors: FloorDto[]` (`id`, `name`, `assetId`, `assetKind`, `walls`, `lights`, `drawings`) + `tableFloorId`. For a player, `floors` holds only the one floor they see (no names or ids of others). `TokenDto.floorId`.
- Floor a player sees: floor of their first controlled token in the active scene (stable order); if they control tokens on several floors, a small switcher lists only those floors; no token -> `tableFloorId`. Game master sees any floor, defaults to `tableFloorId`.
- Only the game master moves a token between floors ("move to floor"), keeping x/y unless given. Players never change floors by themselves.
- Server-side everything uses the token's / viewer's floor: wall blocking on `token.move`, `visionRegion`, which tokens a player is told about, who receives a drawing update, who receives a ping.
- Videos: at most one playing; the ghost neighbour is a second element, paused on its first frame; switching floors disposes the old one. Hidden tab pauses (existing). Reduced motion starts paused (existing rule).
- Import: several files `Name_0`, `Name_1`... become **one scene with N floors**, floor names from the file names, position from the suffix. The importer checks all share size and grid; if not, it falls back to one scene per file with a warning.
- Export: Universal VTT export is per floor (a menu entry per floor). World zip carries `floors`; files without `floors` import as one floor (legacy).
- Undo: floor add and rename, and moving a token between floors, are undoable; deleting a floor (it deletes its tokens, walls, lights, drawings) asks for confirmation and is not undoable. Switching the viewed floor is view state, not undoable.
- Floor shortcut: `PageUp` / `PageDown` for the game master; player switcher is a labelled select, keyboard operable.

## Steps (one commit each; every step ends with typecheck, test, check:i18n, biome check, test:e2e, check:bundle green)

1. `feat(shared): add floors to the scene model` — types, zod schemas, pure `floorForViewer` helper, unit tests.
2. `feat(server): store floors and move walls, lights, drawings and tokens onto them` — migration, SceneService CRUD, token/drawing `floor_id`, tests (migration of an existing DB).
3. `feat(server): send each viewer only their floor` — hub state, token/vision/ping/drawing publishing, `token.move` blocking per floor, move-token-to-floor endpoint, **leak tests** (REST, WS state, token.upsert, drawings, pings, vision; a player on floor 1 never gets floor 0 data, including after being moved).
4. `feat(server): floors in the world file and Universal VTT export` — portability, legacy import test, `docs/world-file-format.md`.
5. `refactor(client): draw the viewed floor` — types, MapView reads the viewed floor, store `viewFloorId`, existing tests green.
6. `feat(client): floor switcher, floor management and move token to floor` — game master switcher, ScenePanel floor list (add, rename, reorder, delete), token action, player select, shortcuts, i18n en + pt-br, undo entries, component tests + axe.
7. `feat(client): play one floor video at a time with a ghost of the neighbour` — video lifecycle, ghost, reduced motion, unit tests.
8. `feat(client): import several floors as one map` — `prepareMapImports` groups into one draft with floors, dialog preview, tests with synthetic files.
9. `test(e2e): multi-floor map` — fixture videos made with ffmpeg (small), floor switch, token change, player isolation; then validate in the browser with the four real samples (not copied into git).
10. `docs: describe floors in the roadmap` — `docs/ROADMAP.md` (floors built; scene transitions entry updated).

## Risks

- Step 5 touches every place that reads `scene.assetId/walls/lights/drawings`; done as a mechanical refactor before any behavior.
- Bundle: the sign-in bundle (213/215 KB gzip) is not touched, all new client code lives in the lazy table chunk; checked every step.
- Four 7 MB videos in one world: upload stays one asset per floor under the existing video limit (100 MiB each).
