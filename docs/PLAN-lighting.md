# Plan: real lighting (darkness, light pools, feather)

Local planning note (not committed). Server stays the source of truth; hidden data never leaves it.

## Why

Today lights are only imported (Universal VTT / Foundry) and drawn as a flat 12 % disc for the game master (`MapView.tsx` `drawMapData`). Players never receive them. Vision already works server-side (`vision.ts`: token sight + lights inside that sight, stopped by walls and closed doors) but the fog it produces is a hard-edged mask at a fixed 94 % black. A friend suggested a **feather** on the lights: a soft falloff at the edge of a light instead of a cut. That only means something once a light actually lights something, so this plan builds the lighting and the feather together.

Goals: a scene can be dark (ambient light level); each light lights a pool shaped by walls (when `shadows`), tinted by its color, bright in the middle and fading out over its **feather**; the same soft edge on the fog boundary; the game master can place, drag and edit lights in the app; players get only what they could see anyway.
Non-goals: dynamic/animated lights (flicker), light through floors, per-token light sources (torch carried by a token), darkvision types, blend modes beyond normal, re-baking an image's lighting.
Anti-goals: leaking a light, wall or lit area the player cannot see (hidden rooms, other floors); a slow map (hundreds of lights must stay smooth); changing how existing scenes look until the game master turns darkness on.

## Decisions (mine, say if you disagree)

- `scene.ambientLight`: 0..1, default **1** (fully lit, today's look). Below 1 the scene is dark: everything outside a light pool or token sight is covered by black at `1 - ambientLight`. `bakedLighting` scenes ignore it (their image already has the light drawn).
- `light.feather`: 0..1, default **0.4**, the fraction of the radius over which the light fades to nothing. The bright core is `radius * (1 - feather)`. `radius` stays the outer edge (so imported lights and `vision.ts` keep their meaning); `intensity` (already 0..10, default 1) scales brightness, clamped to 1 for the darkness cut-out and used above 1 only for the color glow.
- Light pool = `visibilityPolygon` from the light (already in shared) when `shadows`, a plain circle when not. Drawn as a radial gradient clipped by that polygon.
- Fog edge: the visible-area mask gets a fixed soft edge (about `gridSize / 6`), not configurable.
- Players: `VisionDto` gains `lights` (polygon + color, intensity, feather, center, radius) for the lights already counted by `visionRegion` (a light inside a token's sight). Nothing else about lights is sent; the lit polygons are inside the visible area the server already sends, so no new information leaks. Raw `floor.lights` stays empty for players.
- Game master view: darkness is drawn at half strength so the map stays workable; the "lighting preview" layer toggle (replaces today's `lightRange` flat disc) shows full darkness and the player-style result.
- Light editor: a new map tool "light" (click to place, drag to move, Delete to remove) plus fields in the selection panel (radius, color, intensity, feather, shadows). Edits go through the existing floor `PATCH` that replaces `lights`. Undoable like walls/drawings edits.
- Render approach is decided by Task 1 (spike) before anything else is built; the plan assumes Pixi 8's `erase` blend in a render-group container, with a pre-rendered radial gradient texture per (feather) as the fallback.

## Steps (one commit each; every step ends with typecheck, test, check:i18n, biome check, test:e2e, check:bundle green)

1. **Spike (throwaway, not committed):** in a scratch page draw 1 dark rect + 3 lights with a radial gradient, polygon-clipped, `erase` blend. Output: a note in this file of what works at 200 lights (frame time) and which of the two render approaches wins.
2. `feat(shared): add ambient light and light feather to the scene model` — `ambientLight`, `feather` in types and zod schemas (defaults keep old data valid), UVTT/Foundry importers set feather from their own falloff when present, else default; world file reads/writes both (`docs/world-file-format.md`). Unit tests: defaults, bounds, round trip.
3. `feat(server): store ambient light and feather` — migration (`scenes.ambient_light REAL NOT NULL DEFAULT 1`, `lights.feather REAL NOT NULL DEFAULT 0.4`), SceneService read/write, test on an existing DB.
4. `feat(server): send lit areas to players` — `visionRegion` also returns the per-light polygons; `VisionDto.lights`; `flattenPolygons` reuse; **leak tests**: a light in another room, behind a closed door or on another floor never appears in a player's `vision`; opening the door adds it; moving the token away removes it.
5. `feat(client): draw darkness, light pools and a soft fog edge` — new lighting layer in `MapView` reading `vision.lights` (player) or `floor.lights` + local `visibilityPolygon` (game master); feather as gradient stops; soft fog edge; skipped when `ambientLight === 1` and not `bakedLighting`-aware; recomputed only when lights/walls/doors/scene change (not per frame). Tests on the pure gradient/stop math; one e2e screenshot check that a lit pool is lighter than its surroundings.
6. `feat(client): place and edit lights` — "light" tool, drag, selection panel fields (Slider for feather/radius/intensity, ColorPicker, shadows toggle), delete, undo entries, i18n en + pt-br, component test + axe.
7. `feat(client): ambient light setting and lighting preview toggle` — ScenePanel slider, layers menu entry, i18n.
8. `test(e2e): lighting` — dark scene, torch placed, player sees the pool only after the token gets close, door opens it, feather slider visibly softens the edge (pixel gradient sample); then try with the real Dungeon Alchemist samples.
9. `docs: describe lighting in the roadmap` — `docs/ROADMAP.md`.

## Review focus

- 1000 lights on one floor (the cap): game master view must stay interactive; recompute polygons lazily and cap the ones drawn at once if needed.
- Light with `radius 0`, `feather 0` (hard edge) and `feather 1` (no bright core) render without NaN gradients.
- Light exactly on a wall endpoint or inside a wall corner: pool does not leak through the wall.
- `ambientLight` changed while a player is connected updates their view without reload.
- Scene with `visionEnabled` off but `ambientLight < 1`: darkness and pools still draw (lighting does not depend on vision).
- Floor switch: pools of the previous floor are gone immediately, no stale lights.

## Risks

- Step 5 is the real unknown (Pixi blend/mask behavior at scale); that is why step 1 comes first and may change the approach.
- Bundle: all new client code goes in the lazy table chunk; the sign-in bundle is not touched.
- Fog softness costs a blur; if it is too slow on phones, fall back to a feathered gradient texture on the mask instead of a filter.
