# Tutorial: lighting and fog of war

Fog of war means players only see what their own tokens could see: shaped by walls, closed doors and light. All of it is computed on the **server**, which sends each player only the visible area. Walls and lights themselves are never sent to players.

## What you need

1. A scene with **walls** (and doors). The easiest way is to import a Universal VTT map: [tutorial-importing-maps.md](tutorial-importing-maps.md).
2. At least one token that a player controls (**Who can move it**) on the shown scene.

## Turn fog on

1. In the **Scenes** tab, open **Scene settings** for the scene.
2. Switch on **Fog of war**. Set **Sight range (cells)**, how far a token sees before light and walls are considered.
3. Move a token near a wall: the area behind it goes dark for that player.

If nothing changes, the scene has no walls (plain image import).

## Make the scene dark

The **Ambient light** slider in the scene settings controls how lit the scene is. At 100 % everything within sight is visible. Below 100 the scene is dark, and only light pools and what tokens see reveal the map.

## Place lights

1. Choose the **Lights** tool on the map toolbar.
2. Click the map to place a light, click a light to edit it, drag it to move it. Options:
   - **Reach (cells)**: radius of the pool.
   - **Soft edge**: how gradually it fades.
   - **Brightness** and **Color**.
   - **Walls block the light**: when off, light passes through walls.
3. Remove a light with **Remove light**. Placing, moving and editing lights is undoable (`Ctrl+Z`).

Lights imported from a map arrive with the same settings and can be edited the same way.

## Preview what players see

- **Layers** menu on the map: **View as player** picks a player; you see the map, tokens and fog the way they do. This works only when fog of war is on.
- **Lighting preview** in the same menu shows the real darkness while you edit.
- Pick **Game master (see everything)** to return.

## Doors

Click the circle on a door to open or close it. A closed door blocks sight and light, like a wall; an open one lets both through.

## Good to know

- The map picture is only darkened on screen for players; the file is still downloadable. Keep secrets out of the image itself.
- Each player only receives the floor their token stands on; see floors in the [roadmap](ROADMAP.md#built).
- Tokens cannot walk through walls or closed doors.
- How the server keeps this safe: [ARCHITECTURE.md](ARCHITECTURE.md#visibility).
