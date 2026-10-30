# World file format

A world is exported as a single zip (`<name>.openvtt.zip`) containing:

```
world.json
assets/<uuid>.<png|jpg|webp>
```

`world.json` has `format: "openvtt-world"` and `version: 1`, plus the world settings (name, system id, sheet template overrides, active scene), `assets`, `scenes`, `actors`, `tokens` and `messages`. Ids inside the file only link records to each other; importing assigns fresh ids.

Each scene may carry `walls` (segments `x1,y1,x2,y2` in map pixels, `kind` `wall` or `door`, `open` for doors), `lights` (`x`, `y` in pixels, `radius` in grid cells, `intensity`, `color` as `#rrggbb`, `shadows`), `bakedLighting`, and `floorGroup` / `floor` for maps imported as several floors. All are optional: files written before they existed still import, with empty lists. Importers ignore unknown fields.

Each scene may also carry `drawings`: `kind` (`free`, `line`, `arrow`, `rect`, `circle`, `text` or `note`), `layer` (`background`, `objects` or `gm`), `points` (flat `[x1, y1, x2, y2, ...]` in map pixels), `color` (`#rrggbb`) and `text`. Who drew them is not exported. Notes always land on the `gm` layer.

Each token may also carry `hp` and `hpMax` (both `null` for no health bar), `conditions` (a list of ids such as `prone` or `poisoned`) and `showName`. These are optional too.

What is **not** exported, on purpose:

- user accounts and memberships: the importer becomes the game master of the new world, so token controllers and sheet owners are cleared;
- whispers and GM-only rolls.

Import checks the structure, that every reference resolves, that images really are PNG/JPEG/WebP, that sheet data fits the template and that the rules system is installed. Nothing is created if any check fails.
