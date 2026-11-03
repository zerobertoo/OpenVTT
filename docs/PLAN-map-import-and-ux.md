# Plan: map import (block A) and interface/usage improvements (block B)

Local planning note (not committed). Everything stays inside the server process and the data directory (SQLite + files). No external service.

## 1. Research results (what each format carries)

| Format | Image | Grid (px) | Walls | Doors | Lights | Floors | Source | Verdict |
|---|---|---|---|---|---|---|---|---|
| **Universal VTT** `.dd2vtt` / `.uvtt` (JSON) | base64 PNG/WebP | `resolution.pixels_per_grid`, `map_size` in squares, `map_origin` | `line_of_sight` (polylines of `[x,y]`), `objects_line_of_sight` | `portals[]`: `position`, `bounds`, `rotation` (rad), `closed`, `freestanding` | `lights[]`: `position`, `range`, `intensity`, `color`, `shadows`; `environment.ambient_light`, `baked_lighting` | One map per file; DA writes one file per floor | https://arkenforge.com/universal-vtt-files/ , https://help.roll20.net/hc/en-us/articles/41643201127831-Universal-Virtual-Tabletop-UVTT-Support | **Implement first.** All positions/sizes are in grid squares; only `pixels_per_grid` is px. Roll20, AboveVTT and Foundry modules all accept it, so it is the exchange format. |
| **Foundry export** (DA) | `.jpg/.png/.webp` or video `.webm/.mp4/.m4v` | in the JSON | JSON per floor, walls | `door=1` walls | lights | Sibling pairs `Name_0.webp` + `Name_0.json`, `_1`... one pair per floor | https://foundryvtt.com/packages/da-level-importer | **Implement, but the DA JSON schema is not public** (the page names only wall/door/light). Public reference only for Foundry's own scene shape: `SceneData` (`background`, `width`, `height`, `grid{size,distance,units,type}`, `walls[]`, `lights[]`), `WallData` (`c:[x0,y0,x1,y1]`, `move`, `sight`, `light`, `sound`, `dir`, `door`, `ds`), https://foundryvtt.com/api/v13/ . Needs **sample files** before building. |
| **Image Only** (JPG/PNG/WebP) | yes | not in file; grid dimensions are in the export option ("28x38 grid") | no | no | no | one image per floor | DA export screen (user screenshots) | **Implement**: grid from file name + visual grid adjuster. |
| **Video Export** (`.webm`/`.mp4`) | animated | none | no | no | no | one per floor | DA FAQ (JPG, MP4, WebM digital outputs) | **Already supported** (animated maps). Add guidance + manual grid. |
| **Roll20 export** | via UVTT in practice | | | | | one file per floor | Roll20 help (UVTT upload) | **Covered by UVTT.** A separate Roll20 JSON for walls is not publicly documented; do not implement. |
| **AboveVTT export** | not documented | | | | | | DA FAQ lists it only | **Do not implement** (no public format). Recommend UVTT in the guide. |
| **Fantasy Grounds Unity** | `.jpg` + `.xml` (line-of-sight and lights inside the XML) | | | | | | https://www.dungeonalchemist.com/import-to-fantasy-grounds | **Do not implement** now: XML schema is the proprietary FG map-data format, no public spec. Revisit only with sample files + a public spec. |
| **Print / Order for print** | | | | | | | | Out of scope (nothing to import). |

Facts still unverified (need a real DA export): what "Render lights in image AND export to VTT" changes in the UVTT (likely `baked_lighting`), what "Perspective (3D walls)" does to wall coordinates vs image, whether UVTT `line_of_sight` for doors/windows appears in `objects_line_of_sight`, light colour palette, and how the Foundry JSON addresses coordinates (pixels vs squares).

### Samples I need from you (put in `C:\dev\pessoal\OpenVTT\samples\`, not in git)
Same small map (ideally 2 floors, with a door, a window and a torch), exported as:
1. Universal VTT, "Render lights in image AND export to VTT"
2. Universal VTT, lights not rendered in the image
3. Foundry Export (the whole folder: images + JSONs)
4. Image Only with its grid option (note the grid shown on screen)
5. Video Export
Optionally Roll20 and AboveVTT exports to see if they differ from UVTT. I add `samples/` to `.git/info/exclude`.

Until samples arrive I build the UVTT importer from the public spec (the Arkenforge page) using synthetic test files; the Foundry importer waits for samples.

### Findings from the real samples (`samples/`, Little Oasis, video export)
- **The `.dd2vtt` has `"image": ""` when the map is exported as video.** Image/video travel as a sibling file (`Little Oasis.mp4`, same stem). So the importer must accept the pair `.dd2vtt` + media (or a `.zip` of both) and only use the embedded image when present.
- `format` is `0.2`; `line_of_sight` and `portals` are empty here (the map has no walls). The importer must warn "exported without walls" instead of failing.
- Light `color` is 8 hex digits `ffFFE5BF` (alpha first, `AARRGGBB`); `ambient_light` is `ffffffff`. Parse both 6 and 8 digit forms. `baked_lighting: true` with "render lights in image".
- `map_size` x `pixels_per_grid` equals the media size exactly (28x38 @53 = 1484x2014; 20x30 @68 = 1360x2040 for the "no borders" variant), so it is a free consistency check.
- The Foundry-style JSON (`Little Oasis.json`) is flat: `name`, `width`, `height`, `grid` (px), `shiftX/Y`, `gridDistance`, `gridUnits` ("ft"), `gridColor`, `gridAlpha`, `globalLight`, `darkness`, `lights[{x,y (px), dim, bright (distance units), tintColor, tintAlpha}]`, `walls[]`, `img`, `foreground`. Light radii are in distance units (25 ft / 5 ft = 5 squares, same as UVTT `range`). The wall item shape is still unknown (empty here); I will accept Foundry's public `c:[x0,y0,x1,y1]`, `door`, `ds`, `move`, `sight`.
- Still missing: a sample **with walls and doors** (the Foundry/UVTT wall and portal shapes are unverified against real DA output), and a multi-floor export.

## 2. Architecture decisions

- Importers live in `packages/shared` (pure functions: `parseUvtt`, later `parseFoundryScene`, `parseGridFromName`) so server and client use the same validation; the **server** re-validates everything (never trust the file): size caps, finite numbers, max walls/lights counts, coordinates clamped to map bounds, image signature check, decompressed size counted while streaming.
- UVTT is JSON with a base64 image, so it can be large. Parsing happens **in the server** from a streamed upload to a temp file (cap `OPENVTT_MAX_IMPORT_MAP_BYTES`, default 150 MiB, same pattern as video), image decoded stream-wise into an asset on disk. The client sends the file; the dialog shows a preview from a `POST /api/worlds/:id/imports/preview` (returns image asset id in a temporary state, grid, wall/door/light counts, warnings) and `POST .../imports/commit` creates the scene(s). Temp previews expire and are cleaned up inside the process (timer).
- Scene model: table `walls` (scene_id, x1,y1,x2,y2, kind `wall|window|door`, `blocks_move`, `blocks_sight`, `door_state`), `lights` (scene_id,x,y,radius,bright_radius,color,intensity,shadows), scene columns `ambient_light`, `baked_lighting`, `group_id`/`level` for floors. Coordinates stored in **scene pixels** (importer converts squares x `pixels_per_grid`). SQLite migration + world-file additions (format version stays 1; importers ignore unknown fields) + round-trip tests.
- Hidden-data rule: walls/doors/lights are GM-only until player vision exists. Players receive only what the server computes for them (see step 8). Leak tests: players never get raw walls/lights through REST, WS state, or export.
- Vision stays client-computed for rendering but the server only sends each player what their tokens can see (cell-level reveal), validated server-side.
- Units: world default + scene override + per-user preference; stored canonical in metres? **Decision: store scene `gridDistance` + `distanceUnit` as is and convert on display** (`ft`, `mi`, `m`, `km`, `sq`) with a configurable ft to m factor (default 5 ft = 1.5 m). No lossy rewrite of stored data.
- Dice on screen: animation is purely client-side from the server's result; CSS/SVG tumble (already exists as `DiceRoll`) extended to an overlay; 3D (three + rapier) as lazy chunk only after measuring `check:bundle`; off switch in preferences; reduced motion shows the result only.

## 3. Ordered plan (value x effort), one commit per step

Value: H/M/L. Effort: S (hours) / M (a day) / L (days). Bundle: client JS impact.

### Phase 0: front-end debts (before/parallel, cheap, protects everything after)
| # | Step | Value | Effort | Bundle/server |
|---|---|---|---|---|
| 0.1 | Run impeccable critique + harden on `components/ui` and `components/screens`; fix what is worth it | M | M | none |
| 0.2 | Try export/import of the `.zip` through the real UI, including a world with video; fix findings (e2e for the flow) | H | S | none |
| 0.3 | Linux visual baselines via existing CI (generate with `--update-snapshots` in a CI job artifact; commit Linux PNGs only) | L | S | none |

### Phase A: import
| # | Step | Value | Effort | Notes |
|---|---|---|---|---|
| A1 | `shared`: UVTT parser + validation + unit tests with synthetic files | H | M | no bundle (used server side and in the dialog) |
| A2 | Server: streamed import upload, preview/commit endpoints, `OPENVTT_MAX_IMPORT_MAP_BYTES` | H | M | server only |
| A3 | Client: **Import map** dialog in Scenes (image/video/.dd2vtt/.uvtt; preview, name, grid, distance, warnings; `exported without walls` message; unsupported-format message) | H | M | small |
| A4 | Grid from file name (`map_28x38.png`, `28x38 grid`, `30 x 20`) + visual grid adjuster on the preview (drag handle, size slider, offset) | H | M | small |
| A5 | Unit system (imperial/metric/squares): per-user pref, world/scene default, importer fills it; ruler, chat, sheet use it | H | M | small |
| A6 | Scene model for walls/doors/lights + migration + world file + round-trip tests; UVTT import stores them | H | M | server |
| A7 | Draw walls/doors/lights for the GM in Pixi (toggleable layer), open/close doors, ruler stops at walls (movement blocking optional per scene) | H | M | Pixi only |
| A8 | Multiple floors: import several files in one go (or a `Name_0/_1` set), one scene each, grouped (floor switcher) | M | M | small |
| A9 | Export scene as Universal VTT | M | S | server |
| A10 | In-app guide "How to export from Dungeon Alchemist" (popover/page, en + pt-br, recommended options per format) | H | S | none |
| A11 | Foundry-style scene importer (image + JSON or `.zip`), **after samples** | M | M | server |
| A12 | Player vision, fog and lighting (ROADMAP 3 and 4): raycast in the client over walls, light polygons, server filters what is sent per player + leak tests | H | L | Pixi + small geometry code, no new dependency |
| Not building | Fantasy Grounds XML, AboveVTT, Roll20 JSON (no public specs); reconsider with samples + public docs | | | |

### Phase B1: the two decided items
| # | Step | Value | Effort |
|---|---|---|---|
| B1.1 | Dice on screen (overlay animation per roll visibility: public, whisper, GM only; on/off preference; reduced motion = result only; server result is the truth) | H | M |
| B1.2 | 3D dice (lazy chunk, only if budget allows after measurement) | L | L; decide after B1.1 |

### Phase B2: backlog, evaluated
Cut = not worth it now. Order inside a tier is by value/effort.

**Tier 1 (high value, small/medium): do next**
- Keyboard shortcuts (V, R, space-drag pan, +/-/0, Del, Ctrl+D, Tab, Esc) + expanded `?` panel (S)
- Chat commands `/r`, `/gr`, `/w`, history with arrow up, advantage/disadvantage buttons, roll again (M)
- Initiative tracker (order, turn, round, hide NPCs, next-turn shortcut, active token highlight) (M)
- Ping + GM "look here" (M)
- Multi-select (box + shift-click) and batch move/rotate/delete (M)
- Bulk token import (many images at once) (S)
- Health bar and conditions on tokens, name label option (M)
- Ruler shapes (line, cone, circle, square), diagonal rule (5-10-5 / euclidean) (M)
- Minimap + "center on my token" (S)
- Thumbnails of big images generated in-process (S)
- README + compose for the new limits (S, alongside A2)

**Tier 2 (good value, larger)**
- Simple fog of war (GM reveals/hides areas), before A12 (M)
- Compendium of items/monsters per rules system + drag to map as a linked token (L)
- Drawings, arrows, text, GM notes pins (M)
- Hex grid (pointy/flat) (M)
- Layers (background, objects, tokens, GM only) with lock (M)
- Handouts/journal in markdown, per-world asset library (L)
- "View as player" for the GM (S/M)
- Sounds and "your turn" notification; ambient audio from local files (M)
- Undo/redo for GM actions (L, touches every command)
- Session log export to markdown (S)
- Roles (assistant GM, observer), invite expiry/limit, kick/mute, GM action log (M)
- Backup/restore docs + scheduled export in-process (S/M)
- Responsive/touch polish pass, resizable drawer, focus mode, TV mode (M)
- Perf: Pixi culling, texture cache cap, pause render when tab hidden (S), TanStack Virtual in chat (S), lucide icons (S)
- Tour / first session mode, themes (high contrast, font size, accent per player) (M)

**Cut for now (low value for the cost, or covered elsewhere):** auras (until tokens have ranges from systems), flip/rotate-by-drag as a separate item (folded into multi-select), macros/hotbar (revisit after compendium), print/PDF sheets (browser print stylesheet only), scene transitions (fold into polish), per-token hotbar. Reasonable to revisit after A12.

## 4. Per-step rules
- Gates before each commit: `pnpm typecheck`, `pnpm test`, `pnpm check:i18n`, `pnpm test:e2e`, `pnpm check:bundle`.
- Every UI step: en + pt-br strings, 4.5:1 contrast both themes, visible focus, keyboard operable, reduced motion respected; impeccable critique/harden before closing each block.
- Shared state (pings, drawings, initiative, handouts, walls, vision): server validates by role; a test per feature proves hidden data never reaches players.
- Limits go to README and `compose.yaml` in the same commit that introduces them.

## 5. Decisions taken without asking (tell me if you disagree)
- UVTT first, Foundry importer waits for real samples; FG/AboveVTT/Roll20-JSON are not implemented.
- Walls stored in scene pixels; floors are separate scenes with a shared group.
- Import goes through a server-side preview/commit so a 100 MB `.dd2vtt` is never held in the browser or in memory.
- Units are converted on display, never rewritten in stored data.
- 3D dice deferred until the 2D overlay ships and the bundle is measured.

## 6. Waiting on you
1. Approve/adjust the order above.
2. Samples in `C:\dev\pessoal\OpenVTT\samples\` (list in section 1) for A11 and to validate A1.
